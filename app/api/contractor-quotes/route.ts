import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, quotes } from "../../../db/schema";
import { getContractorActor } from "../../contractor-demo";

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const rows = await getDb().select({ id: quotes.id, jobId: quotes.jobId, externalId: jobRequests.externalId, title: jobRequests.title, category: jobRequests.category, description: jobRequests.description, size: jobRequests.size, timeline: jobRequests.timeline, postalCode: jobRequests.postalCode, amountCents: quotes.amountCents, initialMinCents: quotes.initialMinCents, initialMaxCents: quotes.initialMaxCents, quoteAccuracyDelta: quotes.quoteAccuracyDelta, quoteAccuracyStatus: quotes.quoteAccuracyStatus, availableAt: quotes.availableAt, estimatedStartAt: quotes.estimatedStartAt, estimatedFinishAt: quotes.estimatedFinishAt, status: quotes.status, onsiteVisitAt: quotes.onsiteVisitAt, onsitePreferences: quotes.onsitePreferences, onsiteProposals: quotes.onsiteProposals, workDescription: quotes.workDescription, materials: quotes.materials, measurements: quotes.measurements, depositCents: quotes.depositCents, progressCents: quotes.progressCents, completionCents: quotes.completionCents, finalOptions: quotes.finalOptions, selectedFinalOptionId: quotes.selectedFinalOptionId, createdAt: quotes.createdAt }).from(quotes).innerJoin(jobRequests, eq(quotes.jobId, jobRequests.id)).where(eq(quotes.contractorEmail, user.email)).orderBy(desc(quotes.createdAt));
  const parseSlots = (value: string) => { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.filter((slot): slot is string => typeof slot === "string") : []; } catch { return []; } };
  return Response.json({ quotes: rows.map((quote) => ({ ...quote, onsitePreferences: parseSlots(quote.onsitePreferences), onsiteProposals: parseSlots(quote.onsiteProposals), finalOptions: (() => { try { const parsed = JSON.parse(quote.finalOptions || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })() })) });
}
