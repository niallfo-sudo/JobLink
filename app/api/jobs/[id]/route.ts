import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { changeOrders, jobEvents, jobRequests, messages, quotes, verifiedReviews } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [contractorAccess] = await db.select({ jobId: quotes.jobId }).from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, user.email))).limit(1);
    if (job.ownerEmail !== user.email && !contractorAccess) return Response.json({ error: "Job not found" }, { status: 404 });

    const [eventRows, messageRows, quoteRows, changeOrderRows, reviewRows] = await Promise.all([
      db.select().from(jobEvents).where(eq(jobEvents.jobId, jobId)).orderBy(asc(jobEvents.createdAt)),
      db.select().from(messages).where(eq(messages.jobId, jobId)).orderBy(asc(messages.createdAt)),
      db.select().from(quotes).where(eq(quotes.jobId, jobId)).orderBy(asc(quotes.createdAt)),
      db.select().from(changeOrders).where(eq(changeOrders.jobId, jobId)).orderBy(asc(changeOrders.createdAt)),
      db.select().from(verifiedReviews).where(eq(verifiedReviews.jobId, jobId)).limit(1),
    ]);
    return Response.json({
      job,
      events: eventRows,
      messages: messageRows.map((message) => ({ ...message, mine: message.senderEmail === user.email })),
      quotes: quoteRows,
      changeOrders: changeOrderRows,
      review: reviewRows[0] ?? null,
      viewerRole: job.ownerEmail === user.email ? "homeowner" : "contractor",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
