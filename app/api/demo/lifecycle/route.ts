import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { agreementSignatures, documentRecords, jobEvents, jobRequests, paymentMilestones, paymentRecords, quotes } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

type DemoAction = "seed" | "sign" | "fund" | "approve_all";

function paymentPlan(amountCents: number, depositCents: number, progressCents: number, completionCents: number) {
  if (depositCents + progressCents + completionCents === amountCents && amountCents > 0) return { depositCents, progressCents, completionCents };
  const deposit = Math.round(amountCents * 0.2);
  const progress = Math.round(amountCents * 0.4);
  return { depositCents: deposit, progressCents: progress, completionCents: amountCents - deposit - progress };
}

export async function POST(request: Request) {
  const homeowner = await getChatGPTUser();
  if (!homeowner) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json().catch(() => ({}))) as { jobId?: number; action?: DemoAction };
  if (!Number.isInteger(payload.jobId) || !payload.action || !["seed", "sign", "fund", "approve_all"].includes(payload.action)) return Response.json({ error: "Choose a demo job and action" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, Number(payload.jobId)), eq(jobRequests.ownerEmail, homeowner.email))).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.jobId, job.id), eq(quotes.status, "accepted"))).limit(1);
    if (!quote) return Response.json({ error: "A selected final quote is required before starting the demo" }, { status: 409 });
    const now = new Date();
    const plan = paymentPlan(quote.amountCents, quote.depositCents, quote.progressCents, quote.completionCents);
    const customerFeeCents = Math.round(quote.amountCents * 0.03);
    const snapshot = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, scope: quote.workDescription || job.description, originalRequest: job.description, timeline: job.timeline, contractorName: quote.contractorName, materials: quote.materials || "Demo materials confirmed after on-site verification.", measurements: quote.measurements || "Demo measurements confirmed after on-site verification.", finalStartAt: quote.finalStartAt?.toISOString() ?? null, finalizedCompletionAt: quote.estimatedFinishAt?.toISOString() ?? null, amountCents: quote.amountCents, depositCents: plan.depositCents, progressCents: plan.progressCents, completionCents: plan.completionCents, customerFeeCents, demoSimulation: true });

    if (payload.action === "seed") {
      const existing = await db.select({ documentType: documentRecords.documentType }).from(documentRecords).where(eq(documentRecords.jobId, job.id));
      const types = new Set(existing.map((record) => record.documentType));
      const base = { jobId: job.id, quoteId: quote.id, ownerEmail: homeowner.email, contractorEmail: quote.contractorEmail, content: snapshot };
      if (!types.has("service_agreement")) await db.insert(documentRecords).values({ ...base, externalId: `AGR-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "service_agreement", title: "Demo service agreement", status: "ready_for_signature" });
      if (!types.has("accepted_quote")) await db.insert(documentRecords).values({ ...base, externalId: `QTE-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "accepted_quote", title: "Demo accepted final quote", status: "accepted" });
      if (!types.has("invoice")) await db.insert(documentRecords).values({ ...base, externalId: `INV-DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, documentType: "invoice", title: "Demo invoice", status: "demo_payment_pending" });
      let [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.jobId, job.id)).limit(1);
      if (!payment) [payment] = await db.insert(paymentRecords).values({ jobId: job.id, quoteId: quote.id, ownerEmail: homeowner.email, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, subtotalCents: quote.amountCents, customerFeeCents, totalCents: quote.amountCents + customerFeeCents, contractorPayoutCents: quote.amountCents, releasedCents: 0, status: "demo_pending", processor: "demo" }).returning();
      await db.insert(paymentMilestones).values([
        { paymentId: payment.id, jobId: job.id, milestoneType: "deposit", label: "Demo signing deposit", amountCents: plan.depositCents, status: "awaiting_funding" },
        { paymentId: payment.id, jobId: job.id, milestoneType: "progress", label: "Demo progress checkpoint", amountCents: plan.progressCents, status: "awaiting_funding" },
        { paymentId: payment.id, jobId: job.id, milestoneType: "completion", label: "Demo completion balance", amountCents: plan.completionCents, status: "awaiting_funding" },
      ]).onConflictDoNothing();
      await db.insert(jobEvents).values({ jobId: job.id, eventType: "demo_records_created", label: "Demo agreement, invoice and payment plan created", metadata: JSON.stringify({ simulated: true }) });
      return Response.json({ message: "Demo documents and payment plan created. No money moved.", action: payload.action });
    }

    const [agreement] = await db.select().from(documentRecords).where(and(eq(documentRecords.jobId, job.id), eq(documentRecords.documentType, "service_agreement"))).limit(1);
    if (!agreement) return Response.json({ error: "Generate the demo agreement first" }, { status: 409 });

    if (payload.action === "sign") {
      const consentText = "Demo simulation: both parties reviewed and signed this sample agreement. No legal signature was collected.";
      await db.insert(agreementSignatures).values([
        { documentId: agreement.id, jobId: job.id, signerEmail: homeowner.email, signerRole: "homeowner", signerName: "Demo homeowner signature", consentText, signingMethod: "demo_simulation", userAgent: "JobLink demo simulator", signedAt: now },
        { documentId: agreement.id, jobId: job.id, signerEmail: quote.contractorEmail || "demo-contractor@joblink.example", signerRole: "contractor", signerName: "Demo contractor signature", consentText, signingMethod: "demo_simulation", userAgent: "JobLink demo simulator", signedAt: now },
      ]).onConflictDoUpdate({ target: [agreementSignatures.documentId, agreementSignatures.signerRole], set: { consentText, signingMethod: "demo_simulation", userAgent: "JobLink demo simulator", signedAt: now } });
      await db.update(documentRecords).set({ status: "fully_signed", updatedAt: now }).where(eq(documentRecords.id, agreement.id));
      await db.insert(jobEvents).values({ jobId: job.id, eventType: "demo_agreement_signed", label: "Demo signatures recorded for both parties", metadata: JSON.stringify({ simulated: true }) });
      return Response.json({ message: "Both demo signatures are recorded. This is not a legal signature.", action: payload.action });
    }

    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.jobId, job.id)).limit(1);
    if (!payment) return Response.json({ error: "Generate the demo payment plan first" }, { status: 409 });
    if (payload.action === "fund") {
      if (agreement.status !== "fully_signed") return Response.json({ error: "Simulate both signatures before funding the demo job" }, { status: 409 });
      await db.update(paymentRecords).set({ status: "demo_held", processor: "demo", updatedAt: now }).where(eq(paymentRecords.id, payment.id));
      await db.update(paymentMilestones).set({ status: "demo_held", updatedAt: now }).where(eq(paymentMilestones.paymentId, payment.id));
      await db.update(documentRecords).set({ status: "demo_paid", updatedAt: now }).where(and(eq(documentRecords.jobId, job.id), eq(documentRecords.documentType, "invoice")));
      await db.insert(jobEvents).values({ jobId: job.id, eventType: "demo_funding_held", label: "Full job amount held in the demo ledger", metadata: JSON.stringify({ simulated: true, totalCents: payment.totalCents }) });
      return Response.json({ message: "Demo funding is held. No card was charged and no funds moved.", action: payload.action });
    }

    if (!["demo_held", "demo_partially_released", "demo_released"].includes(payment.status)) return Response.json({ error: "Simulate full-job funding before approvals" }, { status: 409 });
    const milestones = await db.select().from(paymentMilestones).where(eq(paymentMilestones.paymentId, payment.id));
    for (const milestone of milestones) await db.update(paymentMilestones).set({ status: "demo_released", proofNote: `Demo proof and homeowner approval simulated for ${milestone.label.toLowerCase()}.`, proofSubmittedAt: now, homeownerApprovedAt: now, releasedAt: now, updatedAt: now }).where(eq(paymentMilestones.id, milestone.id));
    await db.update(paymentRecords).set({ status: "demo_released", releasedCents: payment.contractorPayoutCents, updatedAt: now }).where(eq(paymentRecords.id, payment.id));
    await db.insert(jobEvents).values({ jobId: job.id, eventType: "demo_approvals_released", label: "Demo progress proof and payment approvals completed", metadata: JSON.stringify({ simulated: true }) });
    return Response.json({ message: "Demo proof, homeowner approvals and all payment releases are now recorded. No funds moved.", action: payload.action });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to run the demo simulation" }, { status: 500 });
  }
}
