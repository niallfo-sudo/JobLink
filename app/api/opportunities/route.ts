import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contractorProfiles, jobRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const db = getDb();
    const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
    if (!profile || profile.verificationStatus !== "verified" || profile.acceptingWork === false) return Response.json({ jobs: [] });
    const jobs = await db.select({
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
    const enabledServices = [profile.primaryService, ...(JSON.parse(profile.services) as string[])].map((service) => service.toLowerCase());
    return Response.json({ jobs: jobs.filter((job) => job.status === "matching" && enabledServices.some((service) => service.includes(job.category.toLowerCase()) || job.category.toLowerCase().includes(service)) && (!job.emergency || profile.emergencyAvailable !== false)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
