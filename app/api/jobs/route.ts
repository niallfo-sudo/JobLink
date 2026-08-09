import { desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { jobAttachments, jobEvents, jobRequests, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type UploadBucket = {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
};

const allowedFileTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime", "video/webm"]);
const maxFileSize = 25 * 1024 * 1024;
const maxTotalFileSize = 50 * 1024 * 1024;

function uploadsBucket() {
  return (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const databaseUnavailable = message.includes("no such table") || message.includes("D1 binding");
  return Response.json({ error: databaseUnavailable ? "Job storage is being prepared. Please try again shortly." : message }, { status: 500 });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const jobs = await getDb().select().from(jobRequests).where(eq(jobRequests.ownerEmail, user.email)).orderBy(desc(jobRequests.createdAt)).limit(20);
    return Response.json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = isMultipart ? await request.formData() : null;
    const payload = (form ? JSON.parse(String(form.get("request") ?? "{}")) : await request.json()) as {
      category?: string; title?: string; description?: string; size?: string;
      timeline?: string; budget?: string; postalCode?: string; emergency?: boolean;
    };
    const files = form ? form.getAll("files").filter((entry): entry is File => entry instanceof File) : [];
    const category = payload.category?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    if (!category || !title || !description) {
      return Response.json({ error: "Category, title and description are required" }, { status: 400 });
    }
    if (files.length > 5) return Response.json({ error: "Choose up to 5 photos or videos." }, { status: 400 });
    if (files.some((file) => !allowedFileTypes.has(file.type))) return Response.json({ error: "Use JPG, PNG, WebP, HEIC, MP4, MOV or WebM files." }, { status: 400 });
    if (files.some((file) => file.size > maxFileSize) || files.reduce((total, file) => total + file.size, 0) > maxTotalFileSize) return Response.json({ error: "Files are limited to 25 MB each and 50 MB total." }, { status: 400 });
    if (files.length && !uploadsBucket()) return Response.json({ error: "File uploads are not configured. Your request was not posted." }, { status: 503 });

    const db = getDb();
    await db.insert(users).values({ email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName } });
    const externalId = `JL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [job] = await db.insert(jobRequests).values({
      externalId, ownerEmail: user.email, category, title, description,
      size: payload.size?.trim() || "Not specified",
      timeline: payload.timeline?.trim() || "Flexible",
      budget: payload.budget?.trim() || "Need guidance",
      postalCode: payload.postalCode?.trim() || "",
      emergency: Boolean(payload.emergency),
      status: files.length ? "uploading" : "matching",
    }).returning();
    const uploads = files.map((file) => ({ file, storageKey: `jobs/${job.id}/${crypto.randomUUID()}` }));
    const storedKeys = uploads.map((upload) => upload.storageKey);
    try {
      if (uploads.length) {
        const bucket = uploadsBucket();
        if (!bucket) throw new Error("File uploads are not configured");
        const attachments = await Promise.all(uploads.map(async ({ file, storageKey }) => {
          await bucket.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type } });
          return { jobId: job.id, ownerEmail: user.email, storageKey, filename: file.name.slice(0, 180) || "job-file", contentType: file.type, sizeBytes: file.size, kind: file.type.startsWith("video/") ? "video" : "image" };
        }));
        await db.insert(jobAttachments).values(attachments);
      }
      const [publishedJob] = await db.update(jobRequests).set({ status: "matching", updatedAt: new Date() }).where(eq(jobRequests.id, job.id)).returning();
      await db.insert(jobEvents).values({ jobId: job.id, eventType: "request_created", label: "Request submitted for matching", metadata: JSON.stringify({ category, attachmentCount: files.length }) });
      return Response.json({ job: publishedJob }, { status: 201 });
    } catch (uploadError) {
      const bucket = uploadsBucket();
      if (bucket && storedKeys.length) await bucket.delete(storedKeys).catch(() => undefined);
      await db.delete(jobRequests).where(eq(jobRequests.id, job.id)).catch(() => undefined);
      console.error("Request upload failed", uploadError);
      return Response.json({ error: "Your files could not be uploaded. Your request was not posted; please try again." }, { status: 500 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
