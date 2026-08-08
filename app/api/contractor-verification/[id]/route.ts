import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../db";
import { contractorVerificationDocuments, users } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

type UploadBucket = { get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null> };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return Response.json({ error: "Invalid document id" }, { status: 400 });
  const db = getDb();
  const [viewer] = await db.select({ role: users.role }).from(users).where(eq(users.email, user.email)).limit(1);
  const isStaff = Boolean(viewer && ["employee", "admin"].includes(viewer.role));
  const [document] = await db.select().from(contractorVerificationDocuments).where(isStaff ? eq(contractorVerificationDocuments.id, id) : and(eq(contractorVerificationDocuments.id, id), eq(contractorVerificationDocuments.ownerEmail, user.email))).limit(1);
  if (!document) return Response.json({ error: "Document not found" }, { status: 404 });
  const storage = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!storage) return Response.json({ error: "Document storage unavailable" }, { status: 503 });
  const object = await storage.get(document.storageKey);
  if (!object) return Response.json({ error: "Document not found" }, { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType || document.contentType, "Content-Disposition": `inline; filename="${document.filename.replaceAll('"', '')}"`, "Cache-Control": "private, no-store" } });
}
