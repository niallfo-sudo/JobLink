import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { documentRecords, jobEvents, jobRequests, quotes } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { notify } from "../../../../../lib/notifications";

const stages = {
  materials_collected: { label: "Materials collected", jobStatus: "booked", rank: 1 },
  work_started: { label: "Work started", jobStatus: "in_progress", rank: 2 },
  halfway: { label: "Work is 50% complete", jobStatus: "in_progress", rank: 3 },
  cleaning: { label: "Final cleanup underway", jobStatus: "in_progress", rank: 4 },
  finished: { label: "Work finished", jobStatus: "completed", rank: 5 },
} as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const jobId = Number(id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  try {
    const payload = (await request.json()) as { stage?: keyof typeof stages };
    const stage = payload.stage && stages[payload.stage];
    if (!payload.stage || !stage) return Response.json({ error: "Invalid progress stage" }, { status: 400 });
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const [acceptedQuote] = await db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.status, "accepted"), eq(quotes.contractorEmail, user.email))).limit(1);
    if (!acceptedQuote) return Response.json({ error: "Only the selected contractor can update progress" }, { status: 403 });
    if (job.status === "completed" && payload.stage !== "finished") return Response.json({ error: "Completed jobs cannot be moved backward" }, { status: 409 });

    await db.update(jobRequests).set({ status: stage.jobStatus, updatedAt: new Date() }).where(eq(jobRequests.id, jobId));
    await db.insert(jobEvents).values({ jobId, eventType: payload.stage, label: stage.label, metadata: JSON.stringify({ rank: stage.rank, updatedBy: "contractor" }) });
    await notify(job.ownerEmail, { jobId, type: payload.stage, title: stage.label, body: `${acceptedQuote.contractorName} updated ${job.externalId}.` });

    if (payload.stage === "finished") {
      const warrantySnapshot = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, scope: job.description, timeline: job.timeline, contractorName: acceptedQuote.contractorName, amountCents: acceptedQuote.amountCents, warrantyTerm: "Workmanship coverage recorded by the contractor. Final terms are subject to the signed service agreement." });
      await db.insert(documentRecords).values({
        externalId: `WAR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, jobId, quoteId: acceptedQuote.id,
        ownerEmail: job.ownerEmail, contractorEmail: user.email, documentType: "warranty_certificate",
        title: "Warranty certificate", status: "issued", content: warrantySnapshot,
      }).onConflictDoNothing();
    }
    return Response.json({ job: { ...job, status: stage.jobStatus }, event: { eventType: payload.stage, label: stage.label } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
