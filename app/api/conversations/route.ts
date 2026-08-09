import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, quotes } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const db = getDb();
    const [owned, quoted] = await Promise.all([
      db.select().from(jobRequests).where(eq(jobRequests.ownerEmail, user.email)).orderBy(desc(jobRequests.updatedAt)).limit(20),
      db.select({ job: jobRequests }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(and(eq(quotes.contractorEmail, user.email), eq(quotes.status, "accepted"))).orderBy(desc(jobRequests.updatedAt)).limit(20),
    ]);
    const unique = new Map<number, typeof jobRequests.$inferSelect>();
    for (const job of owned) unique.set(job.id, job);
    for (const row of quoted) unique.set(row.job.id, row.job);
    return Response.json({ conversations: Array.from(unique.values()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
