import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const jobs = await getDb().select({
      id: jobRequests.id,
      externalId: jobRequests.externalId,
      category: jobRequests.category,
      title: jobRequests.title,
      description: jobRequests.description,
      budget: jobRequests.budget,
      timeline: jobRequests.timeline,
      postalCode: jobRequests.postalCode,
      emergency: jobRequests.emergency,
      status: jobRequests.status,
      createdAt: jobRequests.createdAt,
    }).from(jobRequests).orderBy(desc(jobRequests.createdAt)).limit(20);
    return Response.json({ jobs: jobs.filter((job) => job.status === "matching") });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
