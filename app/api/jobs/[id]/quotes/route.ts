import { and, asc, avg, count, eq, inArray, ne } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { contractorProfiles, documentRecords, jobEvents, jobRequests, paymentMilestones, paymentRecords, quotes, verifiedReviews } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getContractorActor } from "../../../../contractor-demo";
import { notify } from "../../../../../lib/notifications";

const eligibleSubscriptionStatuses = ["active", "trialing", "demo_active"];
type FinalQuoteOption = { id: string; title: string; description: string; amountCents: number; depositCents: number; progressCents: number; completionCents: number };

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

function estimatedDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function quoteAccuracy(initialMinCents: number, initialMaxCents: number, finalCents: number) {
  if (initialMinCents < 1000 || initialMaxCents < initialMinCents) return { delta: 0, status: "unavailable" };
  const rangeWidth = (initialMaxCents - initialMinCents) / initialMinCents;
  if (finalCents >= initialMinCents && finalCents <= initialMaxCents) {
    const delta = rangeWidth <= 0.15 ? 12 : rangeWidth <= 0.35 ? 8 : 4;
    return { delta, status: rangeWidth <= 0.15 ? "tight_in_range" : rangeWidth <= 0.35 ? "in_range" : "wide_in_range" };
  }
  const distance = finalCents < initialMinCents ? initialMinCents - finalCents : finalCents - initialMaxCents;
  return { delta: -Math.min(6, Math.max(2, Math.ceil((distance / initialMinCents) * 10))), status: "out_of_range" };
}

function publicContractorRatings(input: { reviewCount: number; averageScore: number; acceptedJobCount: number; completedJobCount: number; quoteDeltas: number[] }) {
  const quality = input.reviewCount ? Math.round(input.averageScore / 5) : 0;
  const completion = input.acceptedJobCount ? Math.round((input.completedJobCount / input.acceptedJobCount) * 100) : 0;
  const documentation = input.completedJobCount ? Math.min(100, Math.round((input.reviewCount / input.completedJobCount) * 100)) : 0;
  const jobLinkScore = input.acceptedJobCount ? Math.round(quality * 0.55 + completion * 0.30 + documentation * 0.15) : null;
  const quoteComparisonCount = input.quoteDeltas.length;
  const averageQuoteDelta = quoteComparisonCount ? input.quoteDeltas.reduce((sum, delta) => sum + delta, 0) / quoteComparisonCount : 0;
  const quoteRating = quoteComparisonCount ? Math.max(0, Math.min(100, Math.round(70 + averageQuoteDelta + Math.min(10, Math.max(0, quoteComparisonCount - 1) * 2)))) : null;
  // New businesses are not punished for having no history. Price is only used as a tie-breaker.
  const matchScore = Math.round((jobLinkScore ?? 60) * 0.60 + (quoteRating ?? 70) * 0.35 + (input.reviewCount ? quality : 60) * 0.05);
  return { jobLinkScore, quoteRating, quoteComparisonCount, matchScore };
}

function parseFinalOptions(value: string | null | undefined): FinalQuoteOption[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((option): option is FinalQuoteOption => option && typeof option.id === "string" && typeof option.title === "string" && typeof option.description === "string" && Number.isInteger(option.amountCents) && Number.isInteger(option.depositCents) && Number.isInteger(option.progressCents) && Number.isInteger(option.completionCents)) : [];
  } catch {
    return [];
  }
}

function finalOptionsFromPayload(value: unknown): FinalQuoteOption[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 2) return null;
  const ids = new Set<string>();
  const options: FinalQuoteOption[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const option = raw as { id?: unknown; title?: unknown; description?: unknown; amount?: unknown; depositAmount?: unknown; progressAmount?: unknown; completionAmount?: unknown };
    const id = typeof option.id === "string" ? option.id.trim() : "";
    const title = typeof option.title === "string" ? option.title.trim() : "";
    const description = typeof option.description === "string" ? option.description.trim() : "";
    const amountCents = toCents(option.amount);
    const depositCents = toCents(option.depositAmount);
    const progressCents = toCents(option.progressAmount);
    const completionCents = toCents(option.completionAmount);
    if (!id || ids.has(id) || title.length < 3 || description.length < 10 || amountCents === null || amountCents < 1000 || depositCents === null || progressCents === null || completionCents === null || depositCents + progressCents + completionCents !== amountCents) return null;
    ids.add(id);
    options.push({ id, title, description, amountCents, depositCents, progressCents, completionCents });
  }
  return options;
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
    const db = getDb();
    const rows = await db.select().from(quotes).where(eq(quotes.jobId, jobId)).orderBy(asc(quotes.amountCents));
    const contractorEmails = [...new Set(rows.flatMap((quote) => quote.contractorEmail ? [quote.contractorEmail] : []))];
    const [profiles, ratings, acceptedRows, completedRows, accuracyRows] = contractorEmails.length ? await Promise.all([
      db.select({ ownerEmail: contractorProfiles.ownerEmail, primaryService: contractorProfiles.primaryService, approvedServices: contractorProfiles.approvedServices, homeBase: contractorProfiles.homeBase, serviceRadiusKm: contractorProfiles.serviceRadiusKm, yearsInBusiness: contractorProfiles.yearsInBusiness, teamSize: contractorProfiles.teamSize, emergencyAvailable: contractorProfiles.emergencyAvailable, about: contractorProfiles.about, verificationStatus: contractorProfiles.verificationStatus }).from(contractorProfiles).where(inArray(contractorProfiles.ownerEmail, contractorEmails)),
      db.select({ contractorEmail: verifiedReviews.contractorEmail, reviewCount: count(), averageScore: avg(verifiedReviews.averageScore) }).from(verifiedReviews).where(inArray(verifiedReviews.contractorEmail, contractorEmails)).groupBy(verifiedReviews.contractorEmail),
      db.select({ contractorEmail: quotes.contractorEmail }).from(quotes).where(and(inArray(quotes.contractorEmail, contractorEmails), eq(quotes.status, "accepted"))),
      db.select({ contractorEmail: quotes.contractorEmail }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(and(inArray(quotes.contractorEmail, contractorEmails), eq(quotes.status, "accepted"), eq(jobRequests.status, "completed"))),
      db.select({ contractorEmail: quotes.contractorEmail, quoteAccuracyDelta: quotes.quoteAccuracyDelta }).from(quotes).where(and(inArray(quotes.contractorEmail, contractorEmails), ne(quotes.quoteAccuracyStatus, "pending"), ne(quotes.quoteAccuracyStatus, "unavailable"), ne(quotes.quoteAccuracyStatus, "accepted_out_of_range"))),
    ]) : [[], [], [], [], []];
    const profileByEmail = new Map(profiles.map((profile) => [profile.ownerEmail, profile]));
    const ratingByEmail = new Map(ratings.map((rating) => [rating.contractorEmail, rating]));
    const acceptedByEmail = new Map<string, number>();
    const completedByEmail = new Map<string, number>();
    const accuracyByEmail = new Map<string, number[]>();
    for (const row of acceptedRows) if (row.contractorEmail) acceptedByEmail.set(row.contractorEmail, (acceptedByEmail.get(row.contractorEmail) ?? 0) + 1);
    for (const row of completedRows) if (row.contractorEmail) completedByEmail.set(row.contractorEmail, (completedByEmail.get(row.contractorEmail) ?? 0) + 1);
    for (const row of accuracyRows) if (row.contractorEmail) accuracyByEmail.set(row.contractorEmail, [...(accuracyByEmail.get(row.contractorEmail) ?? []), row.quoteAccuracyDelta ?? 0]);
    const detailedQuotes = rows.map((quote) => {
      const profile = quote.contractorEmail ? profileByEmail.get(quote.contractorEmail) : undefined;
      const rating = quote.contractorEmail ? ratingByEmail.get(quote.contractorEmail) : undefined;
      const publicRatings = quote.contractorEmail ? publicContractorRatings({ reviewCount: Number(rating?.reviewCount ?? 0), averageScore: Number(rating?.averageScore ?? 0), acceptedJobCount: acceptedByEmail.get(quote.contractorEmail) ?? 0, completedJobCount: completedByEmail.get(quote.contractorEmail) ?? 0, quoteDeltas: accuracyByEmail.get(quote.contractorEmail) ?? [] }) : null;
      return { ...quote, finalOptions: parseFinalOptions(quote.finalOptions), contractor: profile ? { ...profile, approvedServices: JSON.parse(profile.approvedServices || "[]"), reviewCount: Number(rating?.reviewCount ?? 0), averageRating: rating?.averageScore ? Number(rating.averageScore) / 100 : null, ...publicRatings } : null };
    });
    detailedQuotes.sort((left, right) => (right.contractor?.matchScore ?? 0) - (left.contractor?.matchScore ?? 0) || left.amountCents - right.amountCents);
    return Response.json({ job, quotes: detailedQuotes });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load quotes" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const payload = (await request.json()) as { minAmount?: number; maxAmount?: number; message?: string; availableAt?: string; estimatedStartAt?: string; completionTimeframe?: string };
  const initialMinCents = toCents(payload.minAmount);
  const initialMaxCents = toCents(payload.maxAmount);
  if (initialMinCents === null || initialMaxCents === null || initialMinCents < 1000 || initialMaxCents < initialMinCents) return Response.json({ error: "Enter a valid initial bid range with a maximum equal to or higher than the minimum" }, { status: 400 });
  const amountCents = Math.round((initialMinCents + initialMaxCents) / 2);
  const completionTimeframe = payload.completionTimeframe?.trim() || "";
  if (completionTimeframe.length < 3 || completionTimeframe.length > 120) return Response.json({ error: "Provide a realistic estimated completion timeframe for this initial quote" }, { status: 400 });
  const preliminaryMessage = `Initial bid range: $${(initialMinCents / 100).toLocaleString()}–$${(initialMaxCents / 100).toLocaleString()}. Estimated completion timeframe: ${completionTimeframe}. ${payload.message?.trim() || "Preliminary estimate only. This is not a booking or accepted price; a finalized quote follows the on-site visit."}`;
  const estimatedStartAt = estimatedDate(payload.estimatedStartAt);
  if (!estimatedStartAt) return Response.json({ error: "Enter an estimated start date for this initial quote" }, { status: 400 });
  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job || job.status !== "matching") return Response.json({ error: "This opportunity is no longer accepting initial quotes" }, { status: 409 });
    const profile = await eligibleProfile(user.email);
    if (!profile || !profile.acceptingWork) return Response.json({ error: "A verified, active contractor profile that is accepting work is required" }, { status: 403 });
    const services = (JSON.parse(profile.approvedServices || "[]") as string[]).map((service) => service.toLowerCase());
    if (!services.some((service: string) => service.includes(job.category.toLowerCase()) || job.category.toLowerCase().includes(service))) return Response.json({ error: "This job is outside your verified services" }, { status: 403 });
    const [existingQuote] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, user.email))).limit(1);
    if (existingQuote) return Response.json({ error: `${profile.businessName} has already submitted a quote for this request. Switch to a different contractor company to submit another quote.` }, { status: 409 });
    const [quote] = await db.insert(quotes).values({ jobId, contractorEmail: user.email, contractorName: profile.businessName, amountCents, initialMinCents, initialMaxCents, message: preliminaryMessage, availableAt: payload.availableAt?.trim() || "On-site availability to be confirmed", estimatedStartAt }).returning();
    await db.insert(jobEvents).values({ jobId, eventType: "quote_submitted", label: `Preliminary bid range received from ${profile.businessName}`, metadata: JSON.stringify({ quoteId: quote.id, initialMinCents, initialMaxCents, completionTimeframe, nonBinding: true }) });
    await notify(job.ownerEmail, { jobId, type: "quote_received", title: "New preliminary estimate", body: `${profile.businessName} submitted a non-binding estimate for ${job.externalId}. Requesting an on-site visit does not select the contractor.` });
    return Response.json({ quote }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to submit quote" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getChatGPTUser();
  const contractor = await getContractorActor();
  if (!identity || !contractor) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  const payload = (await request.json()) as { action?: "request_onsite" | "schedule_onsite" | "submit_final" | "accept_final" | "decline_final"; quoteId?: number; onsiteVisitAt?: string; amount?: number; workDescription?: string; materials?: string; measurements?: string; depositAmount?: number; progressAmount?: number; completionAmount?: number; finalOptions?: unknown; selectedOptionId?: string };
  const quoteId = Number(payload.quoteId);
  if (!Number.isInteger(jobId) || !Number.isInteger(quoteId) || !payload.action) return Response.json({ error: "A quote and workflow action are required" }, { status: 400 });
  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, quoteId), eq(quotes.jobId, jobId))).limit(1);
    if (!job || !quote) return Response.json({ error: "Job or quote not found" }, { status: 404 });

    if (payload.action === "request_onsite") {
      if (job.ownerEmail !== identity.email) return Response.json({ error: "Job not found" }, { status: 404 });
      if (!["matching", "verification_pending", "final_quote_ready"].includes(job.status) || !["submitted", "onsite_requested"].includes(quote.status)) return Response.json({ error: "This estimate is not available for an on-site verification" }, { status: 409 });
      if (!quote.contractorEmail || !await eligibleProfile(quote.contractorEmail)) return Response.json({ error: "This contractor is not currently eligible for verification" }, { status: 409 });
      const [updatedQuote] = await db.update(quotes).set({ status: "onsite_requested" }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "verification_pending", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
      await db.insert(jobEvents).values({ jobId, eventType: "onsite_requested", label: `On-site verification requested from ${quote.contractorName}`, metadata: JSON.stringify({ quoteId }) });
      await notify(quote.contractorEmail, { jobId, type: "onsite_requested", title: "On-site verification requested", body: `Schedule a visit for ${job.externalId} within two business days.` });
      return Response.json({ quote: updatedQuote, job: { ...job, status: "verification_pending" } });
    }

    if (payload.action === "schedule_onsite") {
      if (quote.contractorEmail !== contractor.email || !await eligibleProfile(contractor.email)) return Response.json({ error: "Only the verified contractor can schedule this visit" }, { status: 403 });
      if (!["onsite_requested", "onsite_scheduled"].includes(quote.status)) return Response.json({ error: "The homeowner must request an on-site verification first" }, { status: 409 });
      const visit = validOnsiteVisit(payload.onsiteVisitAt);
      if (!visit) return Response.json({ error: "Schedule a weekday visit within the next two business days" }, { status: 400 });
      const [updatedQuote] = await db.update(quotes).set({ status: "onsite_scheduled", onsiteVisitAt: visit }).where(eq(quotes.id, quote.id)).returning();
      await db.insert(jobEvents).values({ jobId, eventType: "onsite_scheduled", label: `On-site verification scheduled for ${visit.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`, metadata: JSON.stringify({ quoteId, onsiteVisitAt: visit.toISOString() }) });
      await notify(job.ownerEmail, { jobId, type: "onsite_scheduled", title: "On-site visit scheduled", body: `${quote.contractorName} scheduled ${job.externalId} for ${visit.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.` });
      return Response.json({ quote: updatedQuote });
    }

    if (payload.action === "submit_final") {
      if (quote.contractorEmail !== contractor.email || !await eligibleProfile(contractor.email)) return Response.json({ error: "Only the verified contractor can submit this final quote" }, { status: 403 });
      if (!quote.onsiteVisitAt || !["onsite_requested", "onsite_scheduled", "final_quote_ready"].includes(quote.status)) return Response.json({ error: "An on-site verification is required before finalizing the quote" }, { status: 409 });
      const amountCents = toCents(payload.amount);
      const depositCents = toCents(payload.depositAmount);
      const progressCents = toCents(payload.progressAmount);
      const completionCents = toCents(payload.completionAmount);
      const workDescription = payload.workDescription?.trim() || "";
      const materials = payload.materials?.trim() || "";
      const measurements = payload.measurements?.trim() || "";
      const finalOptions = finalOptionsFromPayload(payload.finalOptions);
      const accuracy = quoteAccuracy(quote.initialMinCents, quote.initialMaxCents, amountCents ?? 0);
      if (amountCents === null || amountCents < 1000 || depositCents === null || progressCents === null || completionCents === null || depositCents + progressCents + completionCents !== amountCents) return Response.json({ error: "Payment checkpoints must add up exactly to the final quote" }, { status: 400 });
      if (!finalOptions) return Response.json({ error: "Each alternative needs a title, detailed scope, total and matching payment checkpoints" }, { status: 400 });
      if (workDescription.length < 20 || materials.length < 3 || measurements.length < 3) return Response.json({ error: "Include a detailed work description, materials, and measurements" }, { status: 400 });
      const finalizedAt = new Date();
      const [updatedQuote] = await db.update(quotes).set({ status: "final_quote_ready", amountCents, workDescription, materials, measurements, depositCents, progressCents, completionCents, finalOptions: JSON.stringify(finalOptions), selectedFinalOptionId: null, quoteAccuracyDelta: accuracy.delta, quoteAccuracyStatus: accuracy.status, finalizedAt, message: "Final quote prepared after on-site verification." }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "final_quote_ready", updatedAt: finalizedAt }).where(eq(jobRequests.id, jobId));
      await db.insert(jobEvents).values({ jobId, eventType: "final_quote_ready", label: `Final quote ready from ${quote.contractorName}`, metadata: JSON.stringify({ quoteId, amountCents, depositCents, progressCents, completionCents, alternativeCount: finalOptions.length, quoteAccuracy: accuracy }) });
      await notify(job.ownerEmail, { jobId, type: "final_quote_ready", title: "Final quote ready to review", body: `${quote.contractorName} added the verified scope, materials, measurements, and payment checkpoints for ${job.externalId}.` });
      return Response.json({ quote: updatedQuote, job: { ...job, status: "final_quote_ready" } });
    }

    if (job.ownerEmail !== identity.email) return Response.json({ error: "Job not found" }, { status: 404 });
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
      const selectedOption = payload.selectedOptionId ? parseFinalOptions(quote.finalOptions).find((option) => option.id === payload.selectedOptionId) : null;
      if (payload.selectedOptionId && !selectedOption) return Response.json({ error: "That finalized quote option is no longer available" }, { status: 409 });
      const finalTerms = selectedOption ? { amountCents: selectedOption.amountCents, depositCents: selectedOption.depositCents, progressCents: selectedOption.progressCents, completionCents: selectedOption.completionCents, workDescription: `${selectedOption.title}: ${selectedOption.description}` } : quote;
      const selectedAccuracy = quoteAccuracy(quote.initialMinCents, quote.initialMaxCents, finalTerms.amountCents);
      // A homeowner selecting the contractor confirms the final price was acceptable. Keep
      // the comparison on record, but never penalize the contractor for that outcome.
      const acceptedAccuracy = selectedAccuracy.status === "out_of_range" ? { delta: 0, status: "accepted_out_of_range" } : selectedAccuracy;
      await db.update(quotes).set({ status: "declined" }).where(and(eq(quotes.jobId, jobId), ne(quotes.id, quote.id)));
      const [acceptedQuote] = await db.update(quotes).set({ status: "accepted", amountCents: finalTerms.amountCents, depositCents: finalTerms.depositCents, progressCents: finalTerms.progressCents, completionCents: finalTerms.completionCents, workDescription: finalTerms.workDescription, selectedFinalOptionId: selectedOption?.id ?? null, quoteAccuracyDelta: acceptedAccuracy.delta, quoteAccuracyStatus: acceptedAccuracy.status }).where(eq(quotes.id, quote.id)).returning();
      await db.update(jobRequests).set({ status: "booked", updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
      const customerFeeCents = Math.round(finalTerms.amountCents * 0.03);
      const [paymentRecord] = await db.insert(paymentRecords).values({ jobId, quoteId, ownerEmail: identity.email, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, subtotalCents: finalTerms.amountCents, customerFeeCents, totalCents: finalTerms.amountCents + customerFeeCents, contractorPayoutCents: finalTerms.amountCents, releasedCents: 0, status: "demo_pending", processor: "demo" }).onConflictDoUpdate({ target: paymentRecords.jobId, set: { quoteId, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, subtotalCents: finalTerms.amountCents, customerFeeCents, totalCents: finalTerms.amountCents + customerFeeCents, contractorPayoutCents: finalTerms.amountCents, releasedCents: 0, status: "demo_pending", processor: "demo", updatedAt: new Date() } }).returning();
      await db.insert(paymentMilestones).values([
        { paymentId: paymentRecord.id, jobId, milestoneType: "deposit", label: "Deposit and materials", amountCents: finalTerms.depositCents, status: "awaiting_funding" },
        { paymentId: paymentRecord.id, jobId, milestoneType: "progress", label: "50% progress checkpoint", amountCents: finalTerms.progressCents, status: "awaiting_funding" },
        { paymentId: paymentRecord.id, jobId, milestoneType: "completion", label: "Final completion", amountCents: finalTerms.completionCents, status: "awaiting_funding" },
      ]).onConflictDoUpdate({ target: [paymentMilestones.paymentId, paymentMilestones.milestoneType], set: { status: "awaiting_funding", proofNote: "", proofSubmittedAt: null, homeownerApprovedAt: null, releasedAt: null, updatedAt: new Date() } });
      const snapshot = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, originalRequest: job.description, contractorName: quote.contractorName, finalScope: finalTerms.workDescription, materials: quote.materials, measurements: quote.measurements, amountCents: finalTerms.amountCents, depositCents: finalTerms.depositCents, progressCents: finalTerms.progressCents, completionCents: finalTerms.completionCents, selectedFinalOption: selectedOption ? { id: selectedOption.id, title: selectedOption.title, description: selectedOption.description } : null, customerFeeCents });
      const documentBase = { jobId, quoteId, ownerEmail: identity.email, contractorEmail: quote.contractorEmail };
      await db.insert(documentRecords).values([{ ...documentBase, externalId: `AGR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "service_agreement", title: "Service agreement", status: "ready_for_signature", content: snapshot }, { ...documentBase, externalId: `QTE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "accepted_quote", title: "Accepted final quote", status: "accepted", content: snapshot }, { ...documentBase, externalId: `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "invoice", title: "Invoice", status: "demo_payment_pending", content: snapshot }]).onConflictDoNothing();
      await db.insert(jobEvents).values({ jobId, eventType: "final_quote_accepted", label: `${quote.contractorName} selected after on-site verification`, metadata: JSON.stringify({ quoteId, amountCents: finalTerms.amountCents, selectedOptionId: selectedOption?.id ?? null, quoteAccuracy: acceptedAccuracy }) });
      await notify(quote.contractorEmail, { jobId, type: "final_quote_accepted", title: "Final quote accepted", body: `${job.externalId} is booked. Set the scheduled work start when both parties are ready.` });
      return Response.json({ acceptedQuote });
    }
    return Response.json({ error: "Unsupported quote action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update quote workflow" }, { status: 500 });
  }
}
