import { and, asc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { contractorProfiles, contractorVerificationDocuments } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type UploadBucket = { put(key: string, value: ReadableStream<Uint8Array>, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; delete(key: string): Promise<void> };
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const allowedDocumentTypes = new Set(["government_id", "business_registration", "liability_insurance", "trade_licence"]);

function bucket() {
  const binding = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!binding) throw new Error("Verification upload storage is unavailable");
  return binding;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const documents = await getDb().select({ id: contractorVerificationDocuments.id, documentType: contractorVerificationDocuments.documentType, filename: contractorVerificationDocuments.filename, reviewStatus: contractorVerificationDocuments.reviewStatus, uploadedAt: contractorVerificationDocuments.uploadedAt }).from(contractorVerificationDocuments).where(eq(contractorVerificationDocuments.ownerEmail, user.email)).orderBy(asc(contractorVerificationDocuments.uploadedAt));
  return Response.json({ documents });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const form = await request.formData();
  const documentType = String(form.get("documentType") || "");
  const file = form.get("file");
  if (!allowedDocumentTypes.has(documentType)) return Response.json({ error: "Choose a valid verification document type" }, { status: 400 });
  if (!(file instanceof File) || !file.size) return Response.json({ error: "Choose a document" }, { status: 400 });
  if (!allowedTypes.has(file.type) || file.size > 10 * 1024 * 1024) return Response.json({ error: "Use a PDF, JPG, PNG or WebP file up to 10 MB" }, { status: 400 });
  const db = getDb();
  const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
  if (!profile) return Response.json({ error: "Save your contractor profile before uploading verification documents" }, { status: 409 });
  const storageKey = `contractor-verification/${crypto.randomUUID()}`;
  const storage = bucket();
  try {
    await storage.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type } });
    const [previous] = await db.select({ storageKey: contractorVerificationDocuments.storageKey }).from(contractorVerificationDocuments).where(and(eq(contractorVerificationDocuments.ownerEmail, user.email), eq(contractorVerificationDocuments.documentType, documentType))).limit(1);
    const [document] = await db.insert(contractorVerificationDocuments).values({ ownerEmail: user.email, documentType, storageKey, filename: file.name.slice(0, 180), contentType: file.type, sizeBytes: file.size }).onConflictDoUpdate({ target: [contractorVerificationDocuments.ownerEmail, contractorVerificationDocuments.documentType], set: { storageKey, filename: file.name.slice(0, 180), contentType: file.type, sizeBytes: file.size, reviewStatus: "pending", uploadedAt: new Date() } }).returning();
    if (previous?.storageKey && previous.storageKey !== storageKey) await storage.delete(previous.storageKey).catch(() => undefined);
    await db.update(contractorProfiles).set({ verificationStatus: "pending_review", acceptingWork: false, updatedAt: new Date() }).where(eq(contractorProfiles.ownerEmail, user.email));
    return Response.json({ document: { id: document.id, documentType: document.documentType, filename: document.filename, reviewStatus: document.reviewStatus, uploadedAt: document.uploadedAt } }, { status: 201 });
  } catch {
    await storage.delete(storageKey).catch(() => undefined);
    return Response.json({ error: "Verification document could not be saved" }, { status: 500 });
  }
}
