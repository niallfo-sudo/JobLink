import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { operationsCases, supportRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

function makeReference() {
  return `JL-S${crypto.randomUUID().slice(0, 7).toUpperCase()}`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const requests = await getDb().select().from(supportRequests)
    .where(eq(supportRequests.requesterEmail, user.email))
    .orderBy(desc(supportRequests.createdAt)).limit(20);
  return Response.json({ requests });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { jobExternalId?: string; topic?: string; message?: string };
  const message = payload.message?.trim();
  if (!message || message.length < 10) return Response.json({ error: "Please provide a little more detail" }, { status: 400 });
  if (message.length > 4000) return Response.json({ error: "Message is too long" }, { status: 400 });

  const externalId = makeReference();
  const db = getDb();
  const topic = payload.topic?.trim().slice(0, 50) || "general";
  const [saved] = await db.insert(supportRequests).values({
    externalId,
    requesterEmail: user.email,
    jobExternalId: payload.jobExternalId?.trim().slice(0, 40) ?? "",
    topic,
    message,
  }).returning();
  try {
    const caseType = topic === "safety" ? "fraud" : topic === "account" ? "verification" : "dispute";
    const prefix = caseType === "fraud" ? "FR" : caseType === "verification" ? "VR" : "DS";
    const caseTitle = topic === "payment" ? "Payment or invoice support request" : topic === "safety" ? "Trust and safety report" : topic === "account" ? "Account verification support" : "Job support request";
    await db.insert(operationsCases).values({
      externalId: `${prefix}-S${saved.id}`,
      caseType,
      title: caseTitle,
      subject: saved.jobExternalId || user.displayName,
      summary: message,
      risk: topic === "safety" ? "high" : "medium",
      priority: topic === "safety" ? "urgent" : "normal",
      status: "open",
      assignee: "Unassigned",
      evidenceCount: saved.jobExternalId ? 1 : 0,
      dueLabel: topic === "safety" ? "Respond today" : "Due within 2 business hours",
      details: JSON.stringify({ requesterEmail: user.email, jobExternalId: saved.jobExternalId, supportReference: saved.externalId, signals: ["Customer support request received"] }),
    }).onConflictDoNothing({ target: operationsCases.externalId });
  } catch (error) {
    console.error("Support request could not be queued in Operations", error);
  }
  return Response.json({ request: saved }, { status: 201 });
}
