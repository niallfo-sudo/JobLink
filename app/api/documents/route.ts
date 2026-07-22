import { desc, eq, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { documentRecords, jobRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const rows = await getDb().select({ document: documentRecords, jobTitle: jobRequests.title, jobNumber: jobRequests.externalId })
      .from(documentRecords).innerJoin(jobRequests, eq(documentRecords.jobId, jobRequests.id))
      .where(or(eq(documentRecords.ownerEmail, user.email), eq(documentRecords.contractorEmail, user.email)))
      .orderBy(desc(documentRecords.createdAt)).limit(100);
    return Response.json({ documents: rows.map((row) => ({ ...row.document, jobTitle: row.jobTitle, jobNumber: row.jobNumber })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
