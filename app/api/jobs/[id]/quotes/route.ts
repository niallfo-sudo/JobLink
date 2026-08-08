import { and, asc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { contractorProfiles, documentRecords, jobEvents, jobRequests, paymentRecords, quotes } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { notify } from "../../../../../lib/notifications";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email))).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    if (job.status !== "matching") return Response.json({ error: "This request is no longer accepting a contractor selection" }, { status: 409 });
    const rows = await db.select().from(quotes).where(eq(quotes.jobId, jobId)).orderBy(asc(quotes.amountCents));
    return Response.json({ quotes: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  try {
    const payload = (await request.json()) as { amount?: number; message?: string; availableAt?: string };
    const amountCents = Math.round(Number(payload.amount) * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 1000 || amountCents > 100000000) {
      return Response.json({ error: "Enter a valid quote amount" }, { status: 400 });
    }
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job || job.status !== "matching") return Response.json({ error: "This opportunity is no longer accepting quotes" }, { status: 409 });
    const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
    if (!profile || profile.verificationStatus !== "verified") return Response.json({ error: "A verified contractor profile is required before quoting" }, { status: 403 });
    if (!["active", "trialing", "demo_active"].includes(profile.subscriptionStatus)) return Response.json({ error: "An active contractor subscription is required before quoting" }, { status: 403 });
    if (!profile.acceptingWork) return Response.json({ error: "Turn on accepting new work before quoting" }, { status: 403 });
    const enabledServices = [profile.primaryService, ...JSON.parse(profile.services || "[]")].map((service: string) => service.toLowerCase());
    if (!enabledServices.some((service: string) => service.includes(job.category.toLowerCase()) || job.category.toLowerCase().includes(service))) {
      return Response.json({ error: "This job is outside your verified services" }, { status: 403 });
    }
    const contractorName = profile.businessName;
    const [quote] = await db.insert(quotes).values({
      jobId,
      contractorEmail: user.email,
      contractorName,
      amountCents,
      message: payload.message?.trim() || "Quote includes labour, materials and cleanup.",
      availableAt: payload.availableAt?.trim() || "Schedule to be confirmed",
    }).onConflictDoUpdate({
      target: [quotes.jobId, quotes.contractorEmail],
      set: { contractorName, amountCents, message: payload.message?.trim() || "Quote includes labour, materials and cleanup.", availableAt: payload.availableAt?.trim() || "Schedule to be confirmed", status: "submitted", createdAt: new Date() },
    }).returning();
    await db.insert(jobEvents).values({ jobId, eventType: "quote_submitted", label: `Quote received from ${contractorName}`, metadata: JSON.stringify({ quoteId: quote.id, amountCents }) });
    const [ownerJob] = await db.select({ ownerEmail: jobRequests.ownerEmail, externalId: jobRequests.externalId }).from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    await notify(ownerJob?.ownerEmail, { jobId, type: "quote_received", title: "New quote received", body: `${contractorName} quoted $${(amountCents / 100).toLocaleString()} for ${ownerJob?.externalId}.` });
    return Response.json({ quote }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  const payload = (await request.json()) as { quoteId?: number };
  const quoteId = Number(payload.quoteId);
  if (!Number.isInteger(jobId) || !Number.isInteger(quoteId)) return Response.json({ error: "Valid job and quote ids are required" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email))).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [selected] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.jobId, jobId))).limit(1);
    if (!selected) return Response.json({ error: "Quote not found" }, { status: 404 });
    if (!selected.contractorEmail) return Response.json({ error: "This quote is not linked to a contractor account" }, { status: 409 });
    const [selectedProfile] = await db.select({ verificationStatus: contractorProfiles.verificationStatus, subscriptionStatus: contractorProfiles.subscriptionStatus }).from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, selected.contractorEmail)).limit(1);
    if (!selectedProfile || selectedProfile.verificationStatus !== "verified" || !["active", "trialing", "demo_active"].includes(selectedProfile.subscriptionStatus)) return Response.json({ error: "This contractor is not currently eligible for booking" }, { status: 409 });
    await db.update(quotes).set({ status: "declined" }).where(and(eq(quotes.jobId, jobId), ne(quotes.id, quoteId)));
    await db.update(quotes).set({ status: "accepted" }).where(eq(quotes.id, quoteId));
    await db.update(jobRequests).set({ status: "booked", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
    const customerFeeCents = Math.round(selected.amountCents * 0.03);
    await db.insert(paymentRecords).values({
      jobId, quoteId, ownerEmail: user.email, contractorEmail: selected.contractorEmail,
      contractorName: selected.contractorName, subtotalCents: selected.amountCents,
      customerFeeCents, totalCents: selected.amountCents + customerFeeCents,
      contractorPayoutCents: selected.amountCents, status: "demo_pending", processor: "demo",
    }).onConflictDoUpdate({ target: paymentRecords.jobId, set: {
      quoteId, contractorEmail: selected.contractorEmail, contractorName: selected.contractorName,
      subtotalCents: selected.amountCents, customerFeeCents, totalCents: selected.amountCents + customerFeeCents,
      contractorPayoutCents: selected.amountCents, status: "demo_pending", processor: "demo", updatedAt: new Date(),
    } });
    const documentBase = { jobId, quoteId, ownerEmail: user.email, contractorEmail: selected.contractorEmail };
    const snapshot = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, scope: job.description, timeline: job.timeline, contractorName: selected.contractorName, amountCents: selected.amountCents, customerFeeCents });
    await db.insert(documentRecords).values([
      { ...documentBase, externalId: `AGR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "service_agreement", title: "Service agreement", status: "ready_for_signature", content: snapshot },
      { ...documentBase, externalId: `QTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "accepted_quote", title: "Accepted quote", status: "accepted", content: snapshot },
      { ...documentBase, externalId: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "invoice", title: "Invoice", status: "demo_payment_pending", content: snapshot },
    ]).onConflictDoNothing();
    await db.insert(jobEvents).values({ jobId, eventType: "quote_accepted", label: `${selected.contractorName} selected for the job`, metadata: JSON.stringify({ quoteId, amountCents: selected.amountCents }) });
    await notify(selected.contractorEmail, { jobId, type: "quote_accepted", title: "Your quote was accepted", body: `${job.externalId} is now booked. Open the Job Room to coordinate the work.` });
    return Response.json({ acceptedQuote: { ...selected, status: "accepted" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
