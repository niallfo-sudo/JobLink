import { avg, count, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { verifiedReviews } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const [summary] = await getDb().select({ reviewCount: count(), averageScore: avg(verifiedReviews.averageScore) }).from(verifiedReviews).where(eq(verifiedReviews.contractorEmail, user.email));
    const average = Number(summary?.averageScore ?? 0);
    return Response.json({ reputation: { verifiedReviewCount: Number(summary?.reviewCount ?? 0), averageStars: average ? average / 100 : null, verifiedReviewScore: average ? Math.round(average / 5) : null } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
