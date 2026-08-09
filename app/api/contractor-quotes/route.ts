import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, quotes } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const rows = await getDb().select({ id: quotes.id, jobId: quotes.jobId, externalId: jobRequests.externalId, title: jobRequests.title, category: jobRequests.category, amountCents: quotes.amountCents, availableAt: quotes.availableAt, estimatedStartAt: quotes.estimatedStartAt, estimatedFinishAt: quotes.estimatedFinishAt, status: quotes.status, onsiteVisitAt: quotes.onsiteVisitAt, workDescription: quotes.workDescription, materials: quotes.materials, measurements: quotes.measurements, depositCents: quotes.depositCents, progressCents: quotes.progressCents, completionCents: quotes.completionCents, finalOptions: quotes.finalOptions, selectedFinalOptionId: quotes.selectedFinalOptionId, createdAt: quotes.createdAt }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(eq(quotes.contractorEmail, user.email)).orderBy(desc(quotes.createdAt));
  return Response.json({ quotes: rows.map((quote) => ({ ...quote, finalOptions: (() => { try { const parsed = JSON.parse(quote.finalOptions || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })() })) });
}
