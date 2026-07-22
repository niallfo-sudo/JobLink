import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { jobEvents, jobRequests, quotes, verifiedReviews } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  try {
    const payload = (await request.json()) as { workmanship?: number; communication?: number; punctuality?: number; cleanliness?: number; comment?: string };
    const scores = [payload.workmanship, payload.communication, payload.punctuality, payload.cleanliness].map(Number);
    if (!Number.isInteger(jobId) || scores.some((score) => !Number.isInteger(score) || score < 1 || score > 5)) return Response.json({ error: "All four scores must be between 1 and 5" }, { status: 400 });
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email), eq(jobRequests.status, "completed"))).limit(1);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.status, "accepted"))).limit(1);
    if (!job || !quote?.contractorEmail) return Response.json({ error: "Only completed jobs with a selected contractor can be reviewed" }, { status: 409 });
    const averageScore = Math.round((scores.reduce((total, score) => total + score, 0) / 4) * 100);
    const [review] = await db.insert(verifiedReviews).values({ jobId, ownerEmail: user.email, contractorEmail: quote.contractorEmail, contractorName: quote.contractorName, workmanship: scores[0], communication: scores[1], punctuality: scores[2], cleanliness: scores[3], averageScore, comment: payload.comment?.trim().slice(0, 1000) || "" }).onConflictDoNothing().returning();
    if (!review) return Response.json({ error: "This completed job has already been reviewed" }, { status: 409 });
    await db.insert(jobEvents).values({ jobId, eventType: "verified_review_submitted", label: "Verified homeowner review submitted", metadata: JSON.stringify({ reviewId: review.id, averageScore }) });
    return Response.json({ review }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
