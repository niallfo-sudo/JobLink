import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../db";
import { jobAttachments, jobRequests, paymentMilestones, quotes, users } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getContractorActor } from "../../../../contractor-demo";

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
  const [viewer] = await db.select({ role: users.role }).from(users).where(eq(users.email, email)).limit(1);
  if (viewer && ["employee", "admin"].includes(viewer.role)) return { job, viewerRole: "operations" as const };
  const [contractorAccess] = await db.select({ jobId: quotes.jobId }).from(quotes)
    .where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, email), eq(quotes.status, "accepted"))).limit(1);
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
    stage: jobAttachments.stage,
    milestoneId: jobAttachments.milestoneId,
    createdAt: jobAttachments.createdAt,
  }).from(jobAttachments).where(eq(jobAttachments.jobId, jobId)).orderBy(asc(jobAttachments.createdAt));
  return Response.json({ attachments: attachments.map((attachment) => ({ ...attachment, url: `/api/jobs/${jobId}/attachments/${attachment.id}` })) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const homeowner = await getChatGPTUser();
  if (!homeowner) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  const form = await request.formData();
  const requestedStage = form.get("stage");
  const stage = requestedStage === "pre_work" || requestedStage === "progress" ? requestedStage : null;
  if (!stage) return Response.json({ error: "Choose whether these are before-work or progress photos" }, { status: 400 });
  const contractor = stage === "progress" ? await getContractorActor() : null;
  const uploader = contractor ?? homeowner;
  const access = await authorizedJob(jobId, uploader.email);
  if (!access || (stage === "pre_work" && access.viewerRole !== "homeowner") || (stage === "progress" && access.viewerRole !== "contractor")) return Response.json({ error: "You do not have permission to upload these job photos" }, { status: 403 });
  const milestoneId = stage === "progress" ? Number(form.get("milestoneId")) : null;
  if (stage === "progress" && !Number.isInteger(milestoneId)) return Response.json({ error: "Progress photos must be attached to a payment milestone" }, { status: 400 });
  if (milestoneId) {
    const [milestone] = await getDb().select({ id: paymentMilestones.id }).from(paymentMilestones).where(and(eq(paymentMilestones.id, milestoneId), eq(paymentMilestones.jobId, jobId))).limit(1);
    if (!milestone) return Response.json({ error: "Payment milestone not found for this job" }, { status: 404 });
  }
  const files = form.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);
  if (!files.length || files.length > 5) return Response.json({ error: "Choose between 1 and 5 files" }, { status: 400 });
  if (files.some((file) => !allowedTypes.has(file.type) || !file.type.startsWith("image/"))) return Response.json({ error: "Job documentation must use JPG, PNG, WebP or HEIC images" }, { status: 400 });
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
      milestoneId,
      ownerEmail: uploader.email,
      storageKey,
      filename,
      contentType: file.type,
      sizeBytes: file.size,
      kind,
      stage,
    }))).returning();
    return Response.json({ attachments: saved.map(({ storageKey: _storageKey, ownerEmail: _ownerEmail, ...attachment }) => ({ ...attachment, url: `/api/jobs/${jobId}/attachments/${attachment.id}` })) }, { status: 201 });
  } catch (error) {
    await storage.delete(uploads.map((upload) => upload.storageKey)).catch(() => undefined);
    return Response.json({ error: error instanceof Error ? error.message : "Unable to save files" }, { status: 500 });
  }
}
