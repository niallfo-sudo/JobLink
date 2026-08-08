import { desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, paymentMilestones, paymentRecords } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const rows = await getDb().select({ payment: paymentRecords, job: { externalId: jobRequests.externalId, title: jobRequests.title } })
      .from(paymentRecords).innerJoin(jobRequests, eq(paymentRecords.jobId, jobRequests.id))
      .where(or(eq(paymentRecords.ownerEmail, user.email), eq(paymentRecords.contractorEmail, user.email)))
      .orderBy(desc(paymentRecords.createdAt)).limit(50);
    const ids = rows.map((row) => row.payment.id);
    const milestones = ids.length ? await getDb().select().from(paymentMilestones).where(inArray(paymentMilestones.paymentId, ids)).orderBy(paymentMilestones.id) : [];
    return Response.json({ payments: rows.map((row) => ({ ...row.payment, ...row.job, viewerRole: row.payment.ownerEmail === user.email ? "homeowner" : "contractor", milestones: milestones.filter((milestone) => milestone.paymentId === row.payment.id) })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
