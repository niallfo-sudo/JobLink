import { and, avg, count, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, quotes, verifiedReviews } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const db = getDb();
    const [[summary], [accepted], [completed], [accuracy]] = await Promise.all([
      db.select({ reviewCount: count(), averageScore: avg(verifiedReviews.averageScore) }).from(verifiedReviews).where(eq(verifiedReviews.contractorEmail, user.email)),
      db.select({ count: count() }).from(quotes).where(and(eq(quotes.contractorEmail, user.email), eq(quotes.status, "accepted"))),
      db.select({ count: count() }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(and(eq(quotes.contractorEmail, user.email), eq(quotes.status, "accepted"), eq(jobRequests.status, "completed"))),
      db.select({ comparisonCount: count(), averageDelta: avg(quotes.quoteAccuracyDelta) }).from(quotes).where(and(eq(quotes.contractorEmail, user.email), ne(quotes.quoteAccuracyStatus, "pending"), ne(quotes.quoteAccuracyStatus, "unavailable"), ne(quotes.quoteAccuracyStatus, "accepted_out_of_range"))),
    ]);
    const average = Number(summary?.averageScore ?? 0);
    const verifiedReviewCount = Number(summary?.reviewCount ?? 0);
    const acceptedJobCount = Number(accepted?.count ?? 0);
    const completedJobCount = Number(completed?.count ?? 0);
    const quality = verifiedReviewCount ? Math.round(average / 5) : 0;
    const completion = acceptedJobCount ? Math.round((completedJobCount / acceptedJobCount) * 100) : 0;
    const documentation = completedJobCount ? Math.min(100, Math.round((verifiedReviewCount / completedJobCount) * 100)) : 0;
    const jobLinkScore = acceptedJobCount ? Math.round(quality * 0.55 + completion * 0.30 + documentation * 0.15) : null;
    const quoteComparisonCount = Number(accuracy?.comparisonCount ?? 0);
    const averageQuoteDelta = Number(accuracy?.averageDelta ?? 0);
    const quoteRating = quoteComparisonCount ? Math.max(0, Math.min(100, Math.round(70 + averageQuoteDelta + Math.min(10, Math.max(0, quoteComparisonCount - 1) * 2)))) : null;
    return Response.json({ reputation: { verifiedReviewCount, averageStars: average ? average / 100 : null, verifiedReviewScore: average ? Math.round(average / 5) : null, jobLinkScore, scoreDetails: { quality, completion, documentation }, quoteRating, quoteComparisonCount, averageQuoteDelta: quoteComparisonCount ? Math.round(averageQuoteDelta * 10) / 10 : null } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
