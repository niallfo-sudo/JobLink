import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { jobEvents, jobRequests, paymentMilestones, paymentRecords, quotes } from "../../../../../../db/schema";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { getContractorActor } from "../../../../../contractor-demo";
import { notify } from "../../../../../../lib/notifications";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; milestoneId: string }> }) {
  const identity = await getChatGPTUser();
  const contractor = await getContractorActor();
  if (!identity || !contractor) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id, milestoneId } = await context.params;
  const paymentId = Number(id);
  const idNumber = Number(milestoneId);
  const payload = (await request.json()) as { action?: "submit_proof" | "approve_release"; proofNote?: string };
  if (!Number.isInteger(paymentId) || !Number.isInteger(idNumber) || !payload.action) return Response.json({ error: "A valid payment milestone action is required" }, { status: 400 });
  try {
    const db = getDb();
    const [milestone] = await db.select().from(paymentMilestones).where(and(eq(paymentMilestones.id, idNumber), eq(paymentMilestones.paymentId, paymentId))).limit(1);
    const [payment] = await db.select().from(paymentRecords).where(eq(paymentRecords.id, paymentId)).limit(1);
    if (!milestone || !payment) return Response.json({ error: "Payment milestone not found" }, { status: 404 });
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, payment.jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    if (payload.action === "submit_proof") {
      const [acceptedQuote] = await db.select().from(quotes).where(and(eq(quotes.jobId, payment.jobId), eq(quotes.status, "accepted"), eq(quotes.contractorEmail, contractor.email))).limit(1);
      const proofNote = payload.proofNote?.trim() || "";
      if (!acceptedQuote) return Response.json({ error: "Only the selected contractor can submit progress proof" }, { status: 403 });
      if (payment.status !== "demo_held" && payment.status !== "demo_partially_released") return Response.json({ error: "The homeowner must fund the full job before a release can be requested" }, { status: 409 });
      if (milestone.status !== "demo_held") return Response.json({ error: "This milestone is not ready for proof submission" }, { status: 409 });
      if (proofNote.length < 12) return Response.json({ error: "Describe the completed work and uploaded evidence" }, { status: 400 });
      const now = new Date();
      const [updated] = await db.update(paymentMilestones).set({ status: "proof_submitted", proofNote, proofSubmittedAt: now, updatedAt: now }).where(eq(paymentMilestones.id, milestone.id)).returning();
      await db.insert(jobEvents).values({ jobId: job.id, eventType: "payment_proof_submitted", label: `${milestone.label} proof submitted`, metadata: JSON.stringify({ paymentId, milestoneId: milestone.id, amountCents: milestone.amountCents }) });
      await notify(job.ownerEmail, { jobId: job.id, type: "payment_proof_submitted", title: "Payment release awaiting approval", body: `${payment.contractorName} submitted proof for the ${milestone.label.toLowerCase()} on ${job.externalId}.` });
      return Response.json({ milestone: updated, message: "Proof submitted for homeowner approval." });
    }

    if (payment.ownerEmail !== identity.email) return Response.json({ error: "Only the homeowner can approve a payment release" }, { status: 403 });
    if (milestone.status !== "proof_submitted") return Response.json({ error: "Proof must be submitted before the homeowner can approve a release" }, { status: 409 });
    const now = new Date();
    const [updatedMilestone] = await db.update(paymentMilestones).set({ status: "demo_released", homeownerApprovedAt: now, releasedAt: now, updatedAt: now }).where(eq(paymentMilestones.id, milestone.id)).returning();
    const releasedCents = payment.releasedCents + milestone.amountCents;
    const nextStatus = releasedCents >= payment.contractorPayoutCents ? "demo_released" : "demo_partially_released";
    const [updatedPayment] = await db.update(paymentRecords).set({ status: nextStatus, releasedCents, updatedAt: now }).where(eq(paymentRecords.id, payment.id)).returning();
    await db.insert(jobEvents).values({ jobId: job.id, eventType: "payment_release_approved", label: `${milestone.label} payment approved`, metadata: JSON.stringify({ paymentId, milestoneId: milestone.id, amountCents: milestone.amountCents }) });
    if (payment.contractorEmail) await notify(payment.contractorEmail, { jobId: job.id, type: "payment_release_approved", title: "Payment release approved", body: `${job.externalId}: ${milestone.label} was approved in the JobLink demo ledger.` });
    return Response.json({ payment: updatedPayment, milestone: updatedMilestone, message: "Milestone approved and released in the demo ledger. No funds moved." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update payment milestone" }, { status: 500 });
  }
}
