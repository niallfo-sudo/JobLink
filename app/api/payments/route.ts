import { desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobAttachments, jobRequests, paymentMilestones, paymentRecords, verifiedReviews } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const rows = await getDb().select({ payment: paymentRecords, job: { externalId: jobRequests.externalId, title: jobRequests.title } })
      .from(paymentRecords).innerJoin(jobRequests, eq(paymentRecords.jobId, jobRequests.id))
      .where(or(eq(paymentRecords.ownerEmail, user.email), eq(paymentRecords.contractorEmail, user.email)))
      .orderBy(desc(paymentRecords.createdAt)).limit(50);
    const ids = rows.map((row) => row.payment.id);
    const jobIds = rows.map((row) => row.payment.jobId);
    const [milestones, reviews, attachments] = await Promise.all([
      ids.length ? getDb().select().from(paymentMilestones).where(inArray(paymentMilestones.paymentId, ids)).orderBy(paymentMilestones.id) : [],
      jobIds.length ? getDb().select({ jobId: verifiedReviews.jobId }).from(verifiedReviews).where(inArray(verifiedReviews.jobId, jobIds)) : [],
      jobIds.length ? getDb().select({ jobId: jobAttachments.jobId, kind: jobAttachments.kind, stage: jobAttachments.stage }).from(jobAttachments).where(inArray(jobAttachments.jobId, jobIds)) : [],
    ]);
    const reviewedJobIds = new Set(reviews.map((review) => review.jobId));
    return Response.json({ payments: rows.map((row) => ({ ...row.payment, ...row.job, completionReviewSubmitted: reviewedJobIds.has(row.payment.jobId), preWorkPhotoCount: attachments.filter((attachment) => attachment.jobId === row.payment.jobId && attachment.stage === "pre_work" && attachment.kind === "image").length, viewerRole: row.payment.ownerEmail === user.email ? "homeowner" : "contractor", milestones: milestones.filter((milestone) => milestone.paymentId === row.payment.id) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
