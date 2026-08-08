import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { contractorProfiles, documentRecords, jobEvents, jobRequests, paymentMilestones, paymentRecords, quotes } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { notify } from "../../../../../lib/notifications";

const eligibleSubscriptionStatuses = ["active", "trialing", "demo_active"];

function toCents(value: unknown) {
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100000000 ? cents : null;
}

function secondBusinessDay() {
  const cutoff = new Date();
  cutoff.setUTCHours(23, 59, 59, 999);
  let businessDays = 0;
  while (businessDays < 2) {
    cutoff.setUTCDate(cutoff.getUTCDate() + 1);
    const day = cutoff.getUTCDay();
    if (day !== 0 && day !== 6) businessDays += 1;
  }
  return cutoff;
}

function validOnsiteVisit(value: string | undefined) {
  const visit = value ? new Date(value) : null;
  if (!visit || Number.isNaN(visit.getTime()) || visit <= new Date()) return null;
  const day = visit.getUTCDay();
  if (day === 0 || day === 6 || visit > secondBusinessDay()) return null;
  return visit;
}

async function eligibleProfile(email: string) {
  const [profile] = await getDb().select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, email)).limit(1);
  return profile && profile.verificationStatus === "verified" && eligibleSubscriptionStatuses.includes(profile.subscriptionStatus) ? profile : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  try {
    const [job] = await getDb().select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email))).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const rows = await getDb().select().from(quotes).where(eq(quotes.jobId, jobId)).orderBy(asc(quotes.amountCents));
    return Response.json({ job, quotes: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load quotes" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const payload = (await request.json()) as { amount?: number; message?: string; availableAt?: string };
  const amountCents = toCents(payload.amount);
  if (amountCents === null || amountCents < 1000) return Response.json({ error: "Enter a valid quote amount of at least $10" }, { status: 400 });
  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job || job.status !== "matching") return Response.json({ error: "This opportunity is no longer accepting initial quotes" }, { status: 409 });
    const profile = await eligibleProfile(user.email);
    if (!profile || !profile.acceptingWork) return Response.json({ error: "A verified, active contractor profile that is accepting work is required" }, { status: 403 });
    const services = (JSON.parse(profile.approvedServices || "[]") as string[]).map((service) => service.toLowerCase());
    if (!services.some((service: string) => service.includes(job.category.toLowerCase()) || job.category.toLowerCase().includes(service))) return Response.json({ error: "This job is outside your verified services" }, { status: 403 });
    const [quote] = await db.insert(quotes).values({ jobId, contractorEmail: user.email, contractorName: profile.businessName, amountCents, message: payload.message?.trim() || "Preliminary estimate only. This is not a booking or accepted price; a finalized quote follows the on-site visit.", availableAt: payload.availableAt?.trim() || "On-site availability to be confirmed" }).onConflictDoUpdate({
      target: [quotes.jobId, quotes.contractorEmail],
      set: { amountCents, message: payload.message?.trim() || "Preliminary estimate only. This is not a booking or accepted price; a finalized quote follows the on-site visit.", availableAt: payload.availableAt?.trim() || "On-site availability to be confirmed", status: "submitted", onsiteVisitAt: null, workDescription: "", materials: "", measurements: "", depositCents: 0, progressCents: 0, completionCents: 0, finalizedAt: null, createdAt: new Date() },
    }).returning();
    await db.insert(jobEvents).values({ jobId, eventType: "quote_submitted", label: `Preliminary estimate received from ${profile.businessName}`, metadata: JSON.stringify({ quoteId: quote.id, amountCents, nonBinding: true }) });
    await notify(job.ownerEmail, { jobId, type: "quote_received", title: "New preliminary estimate", body: `${profile.businessName} submitted a non-binding estimate for ${job.externalId}. Requesting an on-site visit does not select the contractor.` });
    return Response.json({ quote }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit quote" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  const payload = (await request.json()) as { action?: "request_onsite" | "schedule_onsite" | "submit_final" | "accept_final" | "decline_final"; quoteId?: number; onsiteVisitAt?: string; amount?: number; workDescription?: string; materials?: string; measurements?: string; depositAmount?: number; progressAmount?: number; completionAmount?: number };
  const quoteId = Number(payload.quoteId);
  if (!Number.isInteger(jobId) || !Number.isInteger(quoteId) || !payload.action) return Response.json({ error: "A quote and workflow action are required" }, { status: 400 });
  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.jobId, jobId))).limit(1);
    if (!job || !quote) return Response.json({ error: "Job or quote not found" }, { status: 404 });

    if (payload.action === "request_onsite") {
      if (job.ownerEmail !== user.email) return Response.json({ error: "Job not found" }, { status: 404 });
      if (!["matching", "verification_pending", "final_quote_ready"].includes(job.status) || !["submitted", "onsite_requested"].includes(quote.status)) return Response.json({ error: "This estimate is not available for an on-site verification" }, { status: 409 });
      if (!quote.contractorEmail || !await eligibleProfile(quote.contractorEmail)) return Response.json({ error: "This contractor is not currently eligible for verification" }, { status: 409 });
      const [updatedQuote] = await db.update(quotes).set({ status: "onsite_requested" }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "verification_pending", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
      await db.insert(jobEvents).values({ jobId, eventType: "onsite_requested", label: `On-site verification requested from ${quote.contractorName}`, metadata: JSON.stringify({ quoteId }) });
      await notify(quote.contractorEmail, { jobId, type: "onsite_requested", title: "On-site verification requested", body: `Schedule a visit for ${job.externalId} within two business days.` });
      return Response.json({ quote: updatedQuote, job: { ...job, status: "verification_pending" } });
    }

    if (payload.action === "schedule_onsite") {
      if (quote.contractorEmail !== user.email || !await eligibleProfile(user.email)) return Response.json({ error: "Only the verified contractor can schedule this visit" }, { status: 403 });
      if (!["onsite_requested", "onsite_scheduled"].includes(quote.status)) return Response.json({ error: "The homeowner must request an on-site verification first" }, { status: 409 });
      const visit = validOnsiteVisit(payload.onsiteVisitAt);
      if (!visit) return Response.json({ error: "Schedule a weekday visit within the next two business days" }, { status: 400 });
      const [updatedQuote] = await db.update(quotes).set({ status: "onsite_scheduled", onsiteVisitAt: visit }).where(eq(quotes.id, quote.id)).returning();
      await db.insert(jobEvents).values({ jobId, eventType: "onsite_scheduled", label: `On-site verification scheduled for ${visit.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`, metadata: JSON.stringify({ quoteId, onsiteVisitAt: visit.toISOString() }) });
      await notify(job.ownerEmail, { jobId, type: "onsite_scheduled", title: "On-site visit scheduled", body: `${quote.contractorName} scheduled ${job.externalId} for ${visit.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.` });
      return Response.json({ quote: updatedQuote });
    }

    if (payload.action === "submit_final") {
      if (quote.contractorEmail !== user.email || !await eligibleProfile(user.email)) return Response.json({ error: "Only the verified contractor can submit this final quote" }, { status: 403 });
      if (!quote.onsiteVisitAt || !["onsite_requested", "onsite_scheduled", "final_quote_ready"].includes(quote.status)) return Response.json({ error: "An on-site verification is required before finalizing the quote" }, { status: 409 });
      const amountCents = toCents(payload.amount);
      const depositCents = toCents(payload.depositAmount);
      const progressCents = toCents(payload.progressAmount);
      const completionCents = toCents(payload.completionAmount);
      const workDescription = payload.workDescription?.trim() || "";
      const materials = payload.materials?.trim() || "";
      const measurements = payload.measurements?.trim() || "";
      if (amountCents === null || amountCents < 1000 || depositCents === null || progressCents === null || completionCents === null || depositCents + progressCents + completionCents !== amountCents) return Response.json({ error: "Payment checkpoints must add up exactly to the final quote" }, { status: 400 });
      if (workDescription.length < 20 || materials.length < 3 || measurements.length < 3) return Response.json({ error: "Include a detailed work description, materials, and measurements" }, { status: 400 });
      const finalizedAt = new Date();
      const [updatedQuote] = await db.update(quotes).set({ status: "final_quote_ready", amountCents, workDescription, materials, measurements, depositCents, progressCents, completionCents, finalizedAt, message: "Final quote prepared after on-site verification." }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "final_quote_ready", updatedAt: finalizedAt }).where(eq(jobRequests.id, jobId));
      await db.insert(jobEvents).values({ jobId, eventType: "final_quote_ready", label: `Final quote ready from ${quote.contractorName}`, metadata: JSON.stringify({ quoteId, amountCents, depositCents, progressCents, completionCents }) });
      await notify(job.ownerEmail, { jobId, type: "final_quote_ready", title: "Final quote ready to review", body: `${quote.contractorName} added the verified scope, materials, measurements, and payment checkpoints for ${job.externalId}.` });
      return Response.json({ quote: updatedQuote, job: { ...job, status: "final_quote_ready" } });
    }

    if (job.ownerEmail !== user.email) return Response.json({ error: "Job not found" }, { status: 404 });
    if (payload.action === "decline_final") {
      if (quote.status !== "final_quote_ready") return Response.json({ error: "Only a final quote can be declined" }, { status: 409 });
      const [updatedQuote] = await db.update(quotes).set({ status: "declined" }).where(eq(quotes.id, quote.id)).returning();
      const remaining = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.jobId, jobId), ne(quotes.id, quote.id), ne(quotes.status, "declined"))).limit(1);
      await db.update(jobRequests).set({ status: remaining.length ? "verification_pending" : "matching", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
      await db.insert(jobEvents).values({ jobId, eventType: "final_quote_declined", label: `Final quote declined from ${quote.contractorName}`, metadata: JSON.stringify({ quoteId }) });
      await notify(quote.contractorEmail, { jobId, type: "final_quote_declined", title: "Final quote declined", body: `${job.externalId} remains open for the homeowner to compare verification options.` });
      return Response.json({ quote: updatedQuote });
    }

    if (payload.action === "accept_final") {
      if (quote.status !== "final_quote_ready" || !quote.contractorEmail) return Response.json({ error: "Only a ready final quote can be accepted" }, { status: 409 });
      await db.update(quotes).set({ status: "declined" }).where(and(eq(quotes.jobId, jobId), ne(quotes.id, quote.id)));
      const [acceptedQuote] = await db.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "booked", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
      const customerFeeCents = Math.round(quote.amountCents * 0.03);
      const [paymentRecord] = await db.insert(paymentRecords).values({ jobId, quoteId, ownerEmail: user.email, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, subtotalCents: quote.amountCents, customerFeeCents, totalCents: quote.amountCents + customerFeeCents, contractorPayoutCents: quote.amountCents, releasedCents: 0, status: "demo_pending", processor: "demo" }).onConflictDoUpdate({ target: paymentRecords.jobId, set: { quoteId, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, subtotalCents: quote.amountCents, customerFeeCents, totalCents: quote.amountCents + customerFeeCents, contractorPayoutCents: quote.amountCents, releasedCents: 0, status: "demo_pending", processor: "demo", updatedAt: new Date() } }).returning();
      await db.insert(paymentMilestones).values([
        { paymentId: paymentRecord.id, jobId, milestoneType: "deposit", label: "Deposit and materials", amountCents: quote.depositCents, status: "awaiting_funding" },
        { paymentId: paymentRecord.id, jobId, milestoneType: "progress", label: "50% progress checkpoint", amountCents: quote.progressCents, status: "awaiting_funding" },
        { paymentId: paymentRecord.id, jobId, milestoneType: "completion", label: "Final completion", amountCents: quote.completionCents, status: "awaiting_funding" },
      ]).onConflictDoUpdate({ target: [paymentMilestones.paymentId, paymentMilestones.milestoneType], set: { status: "awaiting_funding", proofNote: "", proofSubmittedAt: null, homeownerApprovedAt: null, releasedAt: null, updatedAt: new Date() } });
      const snapshot = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, originalRequest: job.description, contractorName: quote.contractorName, finalScope: quote.workDescription, materials: quote.materials, measurements: quote.measurements, amountCents: quote.amountCents, depositCents: quote.depositCents, progressCents: quote.progressCents, completionCents: quote.completionCents, customerFeeCents });
      const documentBase = { jobId, quoteId, ownerEmail: user.email, contractorEmail: quote.contractorEmail };
      await db.insert(documentRecords).values([{ ...documentBase, externalId: `AGR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "service_agreement", title: "Service agreement", status: "ready_for_signature", content: snapshot }, { ...documentBase, externalId: `QTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "accepted_quote", title: "Accepted final quote", status: "accepted", content: snapshot }, { ...documentBase, externalId: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "invoice", title: "Invoice", status: "demo_payment_pending", content: snapshot }]).onConflictDoNothing();
      await db.insert(jobEvents).values({ jobId, eventType: "final_quote_accepted", label: `${quote.contractorName} selected after on-site verification`, metadata: JSON.stringify({ quoteId, amountCents: quote.amountCents }) });
      await notify(quote.contractorEmail, { jobId, type: "final_quote_accepted", title: "Final quote accepted", body: `${job.externalId} is booked. Set the scheduled work start when both parties are ready.` });
      return Response.json({ acceptedQuote });
    }
    return Response.json({ error: "Unsupported quote action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update quote workflow" }, { status: 500 });
  }
}
