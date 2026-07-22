import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { supportRequests } from "../../../db/schema";
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
  const [saved] = await getDb().insert(supportRequests).values({
    externalId,
    requesterEmail: user.email,
    jobExternalId: payload.jobExternalId?.trim().slice(0, 40) ?? "",
    topic: payload.topic?.trim().slice(0, 50) || "general",
    message,
  }).returning();
  return Response.json({ request: saved }, { status: 201 });
}
