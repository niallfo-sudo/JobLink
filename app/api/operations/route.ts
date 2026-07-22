import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobRequests, operationsCaseNotes, operationsCases, paymentRecords, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedStatuses = new Set(["open", "in_review", "waiting", "resolved", "dismissed"]);
const allowedRisks = new Set(["low", "medium", "high", "critical"]);

const seedCases = [
  { externalId: "VR-1208", caseType: "verification", title: "Master electrician licence", subject: "Lakeshore Electric", summary: "Validate the Ontario master electrician licence and expiry date before enabling electrical matching.", risk: "low", priority: "normal", status: "open", assignee: "Unassigned", evidenceCount: 3, dueLabel: "Due today", details: JSON.stringify({ submitted: "8 minutes ago", signals: ["Government ID matched", "Business registration matched", "Licence image uploaded"] }) },
  { externalId: "VR-1207", caseType: "verification", title: "Liability insurance", subject: "Peakline Roofing", summary: "Confirm policy holder, coverage amount and roofing operations endorsement.", risk: "medium", priority: "high", status: "in_review", assignee: "Maya Chen", evidenceCount: 4, dueLabel: "Due in 3h", details: JSON.stringify({ submitted: "24 minutes ago", signals: ["Policy expires in 47 days", "$2M liability shown", "Broker confirmation pending"] }) },
  { externalId: "VR-1206", caseType: "verification", title: "Business identity", subject: "Bluebird Plumbing", summary: "Review business ownership and banking-name alignment.", risk: "low", priority: "normal", status: "waiting", assignee: "Owen Price", evidenceCount: 2, dueLabel: "Due tomorrow", details: JSON.stringify({ submitted: "41 minutes ago", signals: ["Ontario corporation active", "Bank letter requested"] }) },
  { externalId: "FR-1098", caseType: "fraud", title: "Possible duplicate contractor network", subject: "Premier Reno / GTA Project Co.", summary: "Two contractor accounts share a payout account, device fingerprint and six portfolio photos.", risk: "critical", priority: "urgent", status: "open", assignee: "Unassigned", evidenceCount: 18, dueLabel: "Respond in 45m", details: JSON.stringify({ sharedSignals: "8 of 10", jobsAtRisk: "3 · $18,420", signals: ["Shared payout account", "Matching device fingerprint", "Six duplicate project photos"] }) },
  { externalId: "FR-1095", caseType: "fraud", title: "Stolen project photos suspected", subject: "Ontario Elite Exteriors", summary: "Reverse-image matching found portfolio images on an unrelated US contractor website.", risk: "high", priority: "high", status: "in_review", assignee: "Maya Chen", evidenceCount: 11, dueLabel: "Due today", details: JSON.stringify({ matchedPhotos: "11 of 18", currentState: "Matching paused", signals: ["Reverse-image confidence 96%", "Original upload predates contractor account"] }) },
  { externalId: "DS-304", caseType: "dispute", title: "Unapproved electrical change order", subject: "JL-2164 · East Hamilton", summary: "Customer says the $1,280 addition was discussed but never approved in the app.", risk: "high", priority: "urgent", status: "open", assignee: "Noah Singh", evidenceCount: 14, dueLabel: "Response due in 2h", details: JSON.stringify({ contractValue: "$8,920", disputedAmount: "$1,280", signals: ["No signed in-app change order", "Message thread references extra work", "Contractor invoice includes addition"] }) },
  { externalId: "DS-301", caseType: "dispute", title: "Workmanship warranty claim", subject: "JL-1988 · Dundas", summary: "Ceiling seam became visible six weeks after project completion.", risk: "medium", priority: "normal", status: "waiting", assignee: "Owen Price", evidenceCount: 9, dueLabel: "Response due tomorrow", details: JSON.stringify({ contractValue: "$3,400", warranty: "15 years", signals: ["Customer photos received", "Contractor reinspection scheduled"] }) },
];

async function requireOperationsUser() {
  const user = await getChatGPTUser();
  if (!user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) };
  const db = getDb();
  let [record] = await db.select({ role: users.role }).from(users).where(eq(users.email, user.email)).limit(1);
  const [staffCount] = await db.select({ value: sql<number>`count(*)` }).from(users).where(inArray(users.role, ["employee", "admin"]));
  if (!staffCount?.value) {
    await db.insert(users).values({ email: user.email, displayName: user.displayName, role: "admin" }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName, role: "admin" } });
    record = { role: "admin" };
  }
  if (!record || !["employee", "admin"].includes(record.role)) return { error: Response.json({ error: "Employee access required" }, { status: 403 }) };
  return { user, db, role: record.role };
}

async function ensureSeedCases(db: ReturnType<typeof getDb>) {
  const [countRow] = await db.select({ value: sql<number>`count(*)` }).from(operationsCases);
  if (!countRow?.value) await db.insert(operationsCases).values(seedCases);
}

export async function GET() {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    await ensureSeedCases(access.db);
    const cases = await access.db.select().from(operationsCases).orderBy(desc(operationsCases.updatedAt));
    const notes = cases.length ? await access.db.select().from(operationsCaseNotes).where(inArray(operationsCaseNotes.caseId, cases.map((item) => item.id))).orderBy(desc(operationsCaseNotes.createdAt)) : [];
    const [jobCount] = await access.db.select({ value: sql<number>`count(*)` }).from(jobRequests);
    const [activeJobCount] = await access.db.select({ value: sql<number>`count(*)` }).from(jobRequests).where(inArray(jobRequests.status, ["matching", "quoted", "booked", "in_progress"]));
    const [paymentTotal] = await access.db.select({ value: sql<number>`coalesce(sum(${paymentRecords.totalCents}), 0)` }).from(paymentRecords);
    return Response.json({
      viewer: { email: access.user.email, displayName: access.user.displayName, role: access.role },
      cases: cases.map((item) => ({ ...item, details: JSON.parse(item.details || "{}"), notes: notes.filter((note) => note.caseId === item.id) })),
      stats: { jobs: jobCount?.value ?? 0, activeJobs: activeJobCount?.value ?? 0, paymentVolumeCents: paymentTotal?.value ?? 0, openCases: cases.filter((item) => !["resolved", "dismissed"].includes(item.status)).length },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operations workspace unavailable";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    const payload = (await request.json()) as { id?: number; status?: string; risk?: string; assignee?: string; resolution?: string; note?: string };
    if (!Number.isInteger(payload.id)) return Response.json({ error: "Case id is required" }, { status: 400 });
    const [existing] = await access.db.select().from(operationsCases).where(eq(operationsCases.id, Number(payload.id))).limit(1);
    if (!existing) return Response.json({ error: "Case not found" }, { status: 404 });
    if (payload.status && !allowedStatuses.has(payload.status)) return Response.json({ error: "Invalid case status" }, { status: 400 });
    if (payload.risk && !allowedRisks.has(payload.risk)) return Response.json({ error: "Invalid risk level" }, { status: 400 });
    const updates: Partial<typeof operationsCases.$inferInsert> = { updatedAt: new Date() };
    if (payload.status) updates.status = payload.status;
    if (payload.risk) updates.risk = payload.risk;
    if (typeof payload.assignee === "string") updates.assignee = payload.assignee.trim().slice(0, 80) || "Unassigned";
    if (typeof payload.resolution === "string") updates.resolution = payload.resolution.trim().slice(0, 2000);
    await access.db.update(operationsCases).set(updates).where(eq(operationsCases.id, existing.id));
    if (payload.note?.trim()) await access.db.insert(operationsCaseNotes).values({ caseId: existing.id, authorEmail: access.user.email, body: payload.note.trim().slice(0, 2000) });
    const [updated] = await access.db.select().from(operationsCases).where(eq(operationsCases.id, existing.id)).limit(1);
    const notes = await access.db.select().from(operationsCaseNotes).where(eq(operationsCaseNotes.caseId, existing.id)).orderBy(desc(operationsCaseNotes.createdAt));
    return Response.json({ case: { ...updated, details: JSON.parse(updated.details || "{}"), notes } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Case update failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
