import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { agreementSignatures, documentRecords, jobAttachments, jobEvents, jobRequests } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { getContractorActor } from "../../../../contractor-demo";
import { notify } from "../../../../../lib/notifications";

const consentText = "I confirm I reviewed this agreement, intend to sign electronically, and understand this record will be retained by JobLink.";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const identity = await getChatGPTUser();
  const user = await getContractorActor();
  if (!identity || !user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const documentId = Number((await context.params).id);
  const payload = (await request.json()) as { signerName?: string; consent?: boolean };
  if (!Number.isInteger(documentId)) return Response.json({ error: "Invalid document id" }, { status: 400 });
  const signerName = payload.signerName?.trim() || "";
  if (!payload.consent || signerName.length < 2) return Response.json({ error: "Enter your legal name and confirm electronic-signature consent" }, { status: 400 });
  try {
    const db = getDb();
    const [document] = await db.select().from(documentRecords).where(eq(documentRecords.id, documentId)).limit(1);
    if (!document || document.documentType !== "service_agreement") return Response.json({ error: "Service agreement not found" }, { status: 404 });
    const signerRole = document.ownerEmail === user.email ? "homeowner" : document.contractorEmail === user.email ? "contractor" : null;
    if (!signerRole) return Response.json({ error: "You are not a party to this agreement" }, { status: 403 });
    if (signerRole === "homeowner") {
      const photos = await db.select({ id: jobAttachments.id }).from(jobAttachments).where(and(eq(jobAttachments.jobId, document.jobId), eq(jobAttachments.ownerEmail, user.email), eq(jobAttachments.stage, "pre_work"), eq(jobAttachments.kind, "image"))).limit(1);
      if (!photos.length) return Response.json({ error: "Upload at least one before-work photo before signing this agreement" }, { status: 409 });
    }
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, document.jobId)).limit(1);
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    const now = new Date();
    const [signature] = await db.insert(agreementSignatures).values({ documentId, jobId: document.jobId, signerEmail: user.email, signerRole, signerName, consentText, signingMethod: "account_attestation", userAgent: request.headers.get("user-agent")?.slice(0, 500) || "", signedAt: now }).onConflictDoNothing({ target: [agreementSignatures.documentId, agreementSignatures.signerRole] }).returning();
    if (!signature) return Response.json({ error: "You have already signed this agreement. Your signature cannot be submitted twice." }, { status: 409 });
    const signatures = await db.select().from(agreementSignatures).where(eq(agreementSignatures.documentId, documentId));
    const fullySigned = signatures.some((item) => item.signerRole === "homeowner") && signatures.some((item) => item.signerRole === "contractor");
    const [updatedDocument] = await db.update(documentRecords).set({ status: fullySigned ? "fully_signed" : signerRole === "homeowner" ? "signed_by_homeowner" : "signed_by_contractor", updatedAt: now }).where(eq(documentRecords.id, documentId)).returning();
    await db.insert(jobEvents).values({ jobId: document.jobId, eventType: "agreement_signed", label: `${signerRole === "homeowner" ? "Homeowner" : "Contractor"} signed the service agreement`, metadata: JSON.stringify({ documentId, signerRole, signerName, signedAt: now.toISOString() }) });
    const otherParty = signerRole === "homeowner" ? document.contractorEmail : document.ownerEmail;
    if (otherParty) await notify(otherParty, { jobId: document.jobId, type: "agreement_signed", title: fullySigned ? "Service agreement fully signed" : "Service agreement awaiting your signature", body: fullySigned ? `${job.externalId} is ready for its scheduled start once funding is confirmed.` : `${signerName} signed ${job.externalId}. Review and sign the agreement in JobLink.` });
    return Response.json({ document: updatedDocument, signature, fullySigned, consentText });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to sign agreement" }, { status: 500 });
  }
}
