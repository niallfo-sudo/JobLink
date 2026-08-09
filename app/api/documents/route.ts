import { desc, eq, inArray, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { agreementSignatures, documentRecords, jobAttachments, jobRequests } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const rows = await getDb().select({ document: documentRecords, jobTitle: jobRequests.title, jobNumber: jobRequests.externalId })
      .from(documentRecords).innerJoin(jobRequests, eq(documentRecords.jobId, jobRequests.id))
      .where(or(eq(documentRecords.ownerEmail, user.email), eq(documentRecords.contractorEmail, user.email)))
      .orderBy(desc(documentRecords.createdAt)).limit(100);
    const documentIds = rows.map((row) => row.document.id);
    const signatures = documentIds.length ? await getDb().select().from(agreementSignatures).where(inArray(agreementSignatures.documentId, documentIds)).orderBy(agreementSignatures.signedAt) : [];
    const jobIds = [...new Set(rows.map((row) => row.document.jobId))];
    const attachments = jobIds.length ? await getDb().select({ jobId: jobAttachments.jobId, kind: jobAttachments.kind, stage: jobAttachments.stage }).from(jobAttachments).where(inArray(jobAttachments.jobId, jobIds)) : [];
    return Response.json({ documents: rows.map((row) => ({ ...row.document, jobTitle: row.jobTitle, jobNumber: row.jobNumber, viewerRole: row.document.ownerEmail === user.email ? "homeowner" : "contractor", signatures: signatures.filter((signature) => signature.documentId === row.document.id), preWorkPhotoCount: attachments.filter((attachment) => attachment.jobId === row.document.jobId && attachment.stage === "pre_work" && attachment.kind === "image").length })) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
