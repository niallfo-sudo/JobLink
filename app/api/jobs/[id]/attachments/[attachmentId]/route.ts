import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../../db";
import { jobAttachments, jobRequests, quotes } from "../../../../../../db/schema";
import { getChatGPTUser } from "../../../../../chatgpt-auth";

type UploadObject = { body: ReadableStream<Uint8Array> };
type UploadBucket = { get(key: string): Promise<UploadObject | null> };

export async function GET(_request: Request, context: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const params = await context.params;
  const jobId = Number(params.id);
  const attachmentId = Number(params.attachmentId);
  if (!Number.isInteger(jobId) || !Number.isInteger(attachmentId)) return Response.json({ error: "Invalid attachment" }, { status: 400 });

  const db = getDb();
  const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
  if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
  const [contractorAccess] = job.ownerEmail === user.email ? [{ jobId }] : await db.select({ jobId: quotes.jobId }).from(quotes)
    .where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, user.email))).limit(1);
  if (!contractorAccess) return Response.json({ error: "Job not found" }, { status: 404 });

  const [attachment] = await db.select().from(jobAttachments)
    .where(and(eq(jobAttachments.id, attachmentId), eq(jobAttachments.jobId, jobId))).limit(1);
  if (!attachment) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const storage = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!storage) return Response.json({ error: "Upload storage is unavailable" }, { status: 503 });
  const object = await storage.get(attachment.storageKey);
  if (!object) return Response.json({ error: "Attachment not found" }, { status: 404 });
  const safeFilename = attachment.filename.replace(/[\r\n"\\]/g, "_");
  return new Response(object.body, { headers: {
    "Content-Type": attachment.contentType,
    "Content-Disposition": `inline; filename="${safeFilename}"`,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  } });
}
