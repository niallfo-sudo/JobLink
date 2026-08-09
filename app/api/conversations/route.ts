import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, quotes } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const db = getDb();
    const bookedJobs = await db.select({ job: jobRequests }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(and(eq(quotes.contractorEmail, user.email), eq(quotes.status, "accepted"))).orderBy(desc(jobRequests.updatedAt)).limit(20);
    return Response.json({ conversations: bookedJobs.map((row) => row.job) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
