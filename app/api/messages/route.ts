import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, messages, quotes } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

async function accessibleJob(jobId: number, email: string) {
  const [job] = await getDb().select({ id: jobRequests.id }).from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, email))).limit(1);
  if (job) return job;
  const [contractorQuote] = await getDb().select({ jobId: quotes.jobId }).from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, email))).limit(1);
  return contractorQuote;
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number(new URL(request.url).searchParams.get("jobId"));
  if (!Number.isInteger(jobId)) return Response.json({ error: "Valid jobId required" }, { status: 400 });
  try {
    if (!(await accessibleJob(jobId, user.email))) return Response.json({ error: "Job not found" }, { status: 404 });
    const rows = await getDb().select().from(messages).where(eq(messages.jobId, jobId)).orderBy(asc(messages.createdAt));
    return Response.json({ messages: rows });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const payload = (await request.json()) as { jobId?: number; body?: string };
    const jobId = Number(payload.jobId);
    const body = payload.body?.trim() ?? "";
    if (!Number.isInteger(jobId) || !body) return Response.json({ error: "jobId and body are required" }, { status: 400 });
    if (!(await accessibleJob(jobId, user.email))) return Response.json({ error: "Job not found" }, { status: 404 });
    const [message] = await getDb().insert(messages).values({ jobId, senderEmail: user.email, body }).returning();
    return Response.json({ message: { ...message, mine: true } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
