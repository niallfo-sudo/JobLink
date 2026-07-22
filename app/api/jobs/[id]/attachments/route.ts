import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../db";
import { jobAttachments, jobRequests, quotes } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";

type UploadBucket = {
  put(key: string, value: ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
};

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime", "video/webm"]);
const maxFileBytes = 25 * 1024 * 1024;
const maxTotalBytes = 50 * 1024 * 1024;

function bucket() {
  const binding = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!binding) throw new Error("Upload storage is unavailable");
  return binding;
}

async function authorizedJob(jobId: number, email: string) {
  const db = getDb();
  const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
  if (!job) return null;
  if (job.ownerEmail === email) return { job, viewerRole: "homeowner" as const };
  const [contractorAccess] = await db.select({ jobId: quotes.jobId }).from(quotes)
    .where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, email))).limit(1);
  return contractorAccess ? { job, viewerRole: "contractor" as const } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  if (!await authorizedJob(jobId, user.email)) return Response.json({ error: "Job not found" }, { status: 404 });
  const attachments = await getDb().select({
    id: jobAttachments.id,
    filename: jobAttachments.filename,
    contentType: jobAttachments.contentType,
    sizeBytes: jobAttachments.sizeBytes,
    kind: jobAttachments.kind,
    createdAt: jobAttachments.createdAt,
  }).from(jobAttachments).where(eq(jobAttachments.jobId, jobId)).orderBy(asc(jobAttachments.createdAt));
  return Response.json({ attachments: attachments.map((attachment) => ({ ...attachment, url: `/api/jobs/${jobId}/attachments/${attachment.id}` })) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const access = await authorizedJob(jobId, user.email);
  if (!access || access.viewerRole !== "homeowner") return Response.json({ error: "Job not found" }, { status: 404 });

  const form = await request.formData();
  const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.length > 5) return Response.json({ error: "Choose between 1 and 5 files" }, { status: 400 });
  if (files.some((file) => !allowedTypes.has(file.type))) return Response.json({ error: "Use JPG, PNG, WebP, HEIC, MP4, MOV or WebM files" }, { status: 400 });
  if (files.some((file) => file.size > maxFileBytes) || files.reduce((sum, file) => sum + file.size, 0) > maxTotalBytes) {
    return Response.json({ error: "Uploads are limited to 25 MB each and 50 MB total" }, { status: 400 });
  }

  const uploads = files.map((file) => ({
    file,
    storageKey: `jobs/${jobId}/${crypto.randomUUID()}`,
    filename: file.name.slice(0, 180) || "job-file",
    kind: file.type.startsWith("video/") ? "video" : "image",
  }));
  const storage = bucket();
  try {
    await Promise.all(uploads.map(({ file, storageKey }) => storage.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type } })));
    const saved = await getDb().insert(jobAttachments).values(uploads.map(({ file, storageKey, filename, kind }) => ({
      jobId,
      ownerEmail: user.email,
      storageKey,
      filename,
      contentType: file.type,
      sizeBytes: file.size,
      kind,
    }))).returning();
    return Response.json({ attachments: saved.map(({ storageKey: _storageKey, ownerEmail: _ownerEmail, ...attachment }) => ({ ...attachment, url: `/api/jobs/${jobId}/attachments/${attachment.id}` })) }, { status: 201 });
  } catch (error) {
    await storage.delete(uploads.map((upload) => upload.storageKey)).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save files" }, { status: 500 });
  }
}
