import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { changeOrders, jobAttachments, jobEvents, jobRequests, messages, quotes, verifiedReviews } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { notify } from "../../../../lib/notifications";

type UploadBucket = { delete(keys: string | string[]): Promise<void> };

function uploadsBucket() {
  const binding = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!binding) throw new Error("Upload storage is unavailable");
  return binding;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [contractorAccess] = await db.select({ jobId: quotes.jobId }).from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.contractorEmail, user.email))).limit(1);
    if (job.ownerEmail !== user.email && !contractorAccess) return Response.json({ error: "Job not found" }, { status: 404 });

    const [eventRows, messageRows, quoteRows, changeOrderRows, reviewRows, attachmentRows] = await Promise.all([
      db.select().from(jobEvents).where(eq(jobEvents.jobId, jobId)).orderBy(asc(jobEvents.createdAt)),
      db.select().from(messages).where(eq(messages.jobId, jobId)).orderBy(asc(messages.createdAt)),
      db.select().from(quotes).where(eq(quotes.jobId, jobId)).orderBy(asc(quotes.createdAt)),
      db.select().from(changeOrders).where(eq(changeOrders.jobId, jobId)).orderBy(asc(changeOrders.createdAt)),
      db.select().from(verifiedReviews).where(eq(verifiedReviews.jobId, jobId)).limit(1),
      db.select({ id: jobAttachments.id, filename: jobAttachments.filename, contentType: jobAttachments.contentType, sizeBytes: jobAttachments.sizeBytes, kind: jobAttachments.kind, createdAt: jobAttachments.createdAt }).from(jobAttachments).where(eq(jobAttachments.jobId, jobId)).orderBy(asc(jobAttachments.createdAt)),
    ]);
    return Response.json({
      job,
      events: eventRows,
      messages: messageRows.map((message) => ({ ...message, mine: message.senderEmail === user.email })),
      quotes: quoteRows,
      changeOrders: changeOrderRows,
      review: reviewRows[0] ?? null,
      attachments: attachmentRows.map((attachment) => ({ ...attachment, url: `/api/jobs/${jobId}/attachments/${attachment.id}` })),
      viewerRole: job.ownerEmail === user.email ? "homeowner" : "contractor",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const payload = (await request.json()) as { status?: string; scheduledStartAt?: string };
  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });

    if (payload.status === "cancelled") {
      if (job.ownerEmail !== user.email) return Response.json({ error: "Job not found" }, { status: 404 });
      if (job.status !== "matching") return Response.json({ error: "Only unmatched requests can be cancelled" }, { status: 409 });
      const [updated] = await db.update(jobRequests).set({ status: payload.status, updatedAt: new Date() }).where(eq(jobRequests.id, jobId)).returning();
      await db.insert(jobEvents).values({ jobId, eventType: "request_cancelled", label: "Request cancelled", metadata: "{}" });
      return Response.json({ job: updated });
    }

    if (payload.scheduledStartAt) {
      const scheduledStartAt = new Date(payload.scheduledStartAt);
      if (Number.isNaN(scheduledStartAt.getTime())) return Response.json({ error: "Enter a valid scheduled start date and time" }, { status: 400 });
      const [acceptedQuote] = await db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.status, "accepted"), eq(quotes.contractorEmail, user.email))).limit(1);
      if (!acceptedQuote) return Response.json({ error: "Only the selected contractor can schedule this job" }, { status: 403 });
      if (!["booked", "in_progress"].includes(job.status)) return Response.json({ error: "Only booked jobs can be scheduled" }, { status: 409 });
      const [updated] = await db.update(jobRequests).set({ scheduledStartAt, updatedAt: new Date() }).where(eq(jobRequests.id, jobId)).returning();
      const label = `Start scheduled for ${scheduledStartAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}`;
      await db.insert(jobEvents).values({ jobId, eventType: "start_scheduled", label, metadata: JSON.stringify({ scheduledStartAt: scheduledStartAt.toISOString(), updatedBy: "contractor" }) });
      await notify(job.ownerEmail, { jobId, type: "start_scheduled", title: "Job start scheduled", body: `${acceptedQuote.contractorName} scheduled ${job.externalId} for ${scheduledStartAt.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}.` });
      return Response.json({ job: updated });
    }

    return Response.json({ error: "Choose a supported job update" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update job" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });

  try {
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email))).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [acceptedQuote] = await db.select({ id: quotes.id }).from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.status, "accepted"))).limit(1);
    if (job.status !== "matching" || acceptedQuote) return Response.json({ error: "A request can only be deleted before a contractor is accepted" }, { status: 409 });
    const attachments = await db.select({ storageKey: jobAttachments.storageKey }).from(jobAttachments).where(eq(jobAttachments.jobId, jobId));
    if (attachments.length) await uploadsBucket().delete(attachments.map((attachment) => attachment.storageKey));
    await db.delete(jobRequests).where(eq(jobRequests.id, jobId));
    return Response.json({ deletedId: jobId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete job request" }, { status: 500 });
  }
}
