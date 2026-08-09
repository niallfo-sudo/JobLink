import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { documentRecords, jobAttachments, paymentMilestones, paymentRecords } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { paymentId?: number };
  if (!Number.isInteger(payload.paymentId)) return Response.json({ error: "Payment id is required" }, { status: 400 });
  const db = getDb();
  const [payment] = await db.select().from(paymentRecords).where(and(eq(paymentRecords.id, Number(payload.paymentId)), eq(paymentRecords.ownerEmail, user.email))).limit(1);
  if (!payment) return Response.json({ error: "Payment record not found" }, { status: 404 });
  const [agreement] = await db.select().from(documentRecords).where(and(eq(documentRecords.jobId, payment.jobId), eq(documentRecords.documentType, "service_agreement"))).limit(1);
  if (!agreement || agreement.status !== "fully_signed") return Response.json({ error: "Both parties must sign the service agreement before the job can be funded" }, { status: 409 });
  const photos = await db.select({ id: jobAttachments.id }).from(jobAttachments).where(and(eq(jobAttachments.jobId, payment.jobId), eq(jobAttachments.ownerEmail, user.email), eq(jobAttachments.stage, "pre_work"), eq(jobAttachments.kind, "image"))).limit(1);
  if (!photos.length) return Response.json({ error: "Upload at least one before-work photo before funding this job" }, { status: 409 });
  if (["demo_held", "demo_partially_released", "demo_released"].includes(payment.status)) return Response.json({ payment, demo: true, message: "This full-job demo funding record is already held by JobLink." });
  const now = new Date();
  const [updated] = await db.update(paymentRecords).set({ status: "demo_held", processor: "demo", updatedAt: now }).where(eq(paymentRecords.id, payment.id)).returning();
  await db.update(paymentMilestones).set({ status: "demo_held", updatedAt: now }).where(eq(paymentMilestones.paymentId, payment.id));
  return Response.json({ payment: updated, demo: true, message: "Full job amount is now held in the JobLink demo ledger. No card was charged and no funds moved." });
}
