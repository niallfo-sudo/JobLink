import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { contractorProfiles, jobRequests, operationsCaseNotes, operationsCases, paymentRecords, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowedStatuses = new Set(["open", "in_review", "waiting", "resolved", "dismissed"]);
const allowedRisks = new Set(["low", "medium", "high", "critical"]);
const allowedVerificationDecisions = new Set(["approved", "changes_requested", "rejected"]);

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

async function syncPendingVerificationCases(db: ReturnType<typeof getDb>) {
  const pendingProfiles = await db.select().from(contractorProfiles).where(inArray(contractorProfiles.verificationStatus, ["pending", "pending_review"]));
  for (const profile of pendingProfiles) {
    await db.insert(operationsCases).values({
      externalId: `VR-P${profile.id}`,
      caseType: "verification",
      title: "Contractor application review",
      subject: profile.businessName,
      summary: `Verify ${profile.businessName} before enabling ${profile.primaryService.toLowerCase()} matching.`,
      risk: "low",
      priority: "normal",
      status: "open",
      assignee: "Unassigned",
      evidenceCount: 2,
      dueLabel: "Due within 1 business day",
      details: JSON.stringify({ ownerEmail: profile.ownerEmail, primaryService: profile.primaryService, signals: ["Business profile submitted", "Identity and insurance review required"] }),
    }).onConflictDoNothing({ target: operationsCases.externalId });
  }
}

export async function GET() {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    try {
      await syncPendingVerificationCases(access.db);
    } catch (error) {
      console.error("Pending verification cases could not be synchronized", error);
    }
    const cases = await access.db.select().from(operationsCases).orderBy(desc(operationsCases.updatedAt));
    const notes = cases.length ? await access.db.select().from(operationsCaseNotes).where(inArray(operationsCaseNotes.caseId, cases.map((item) => item.id))).orderBy(desc(operationsCaseNotes.createdAt)) : [];
    const [jobCount] = await access.db.select({ value: sql<number>`count(*)` }).from(jobRequests);
    const [activeJobCount] = await access.db.select({ value: sql<number>`count(*)` }).from(jobRequests).where(inArray(jobRequests.status, ["matching", "quoted", "booked", "in_progress"]));
    const [paymentTotal] = await access.db.select({ value: sql<number>`coalesce(sum(${paymentRecords.totalCents}), 0)` }).from(paymentRecords);
    const staff = await access.db.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, createdAt: users.createdAt }).from(users).where(inArray(users.role, ["employee", "admin"]));
    return Response.json({
      viewer: { email: access.user.email, displayName: access.user.displayName, role: access.role },
      staff,
      cases: cases.map((item) => ({ ...item, details: JSON.parse(item.details || "{}"), notes: notes.filter((note) => note.caseId === item.id) })),
      stats: { jobs: jobCount?.value ?? 0, activeJobs: activeJobCount?.value ?? 0, paymentVolumeCents: paymentTotal?.value ?? 0, openCases: cases.filter((item) => !["resolved", "dismissed"].includes(item.status)).length },
    });
  } catch (error) {
    console.error("Operations workspace unavailable", error);
    return Response.json({ error: "Operations workspace unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    const payload = (await request.json()) as { action?: string; email?: string; displayName?: string; role?: string; caseType?: string; title?: string; subject?: string; summary?: string; risk?: string; priority?: string; dueLabel?: string };
    if (payload.action === "case") {
      const caseType = payload.caseType && ["verification", "fraud", "dispute"].includes(payload.caseType) ? payload.caseType : "";
      const title = payload.title?.trim().slice(0, 160) ?? "";
      const subject = payload.subject?.trim().slice(0, 160) ?? "";
      const summary = payload.summary?.trim().slice(0, 2000) ?? "";
      const risk = payload.risk && allowedRisks.has(payload.risk) ? payload.risk : "medium";
      const priority = payload.priority && ["normal", "high", "urgent"].includes(payload.priority) ? payload.priority : "normal";
      if (!caseType || !title || !subject || !summary) return Response.json({ error: "Case type, title, subject and summary are required" }, { status: 400 });
      const prefix = caseType === "verification" ? "VR" : caseType === "fraud" ? "FR" : "DS";
      const [createdCase] = await access.db.insert(operationsCases).values({
        externalId: `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        caseType,
        title,
        subject,
        summary,
        risk,
        priority,
        status: "open",
        assignee: access.user.displayName,
        evidenceCount: 0,
        dueLabel: payload.dueLabel?.trim().slice(0, 80) || (priority === "urgent" ? "Respond today" : "Due in 1 business day"),
        details: JSON.stringify({ createdBy: access.user.email, signals: ["Manually opened by Operations"] }),
      }).returning();
      return Response.json({ case: { ...createdCase, details: JSON.parse(createdCase.details || "{}"), notes: [] } }, { status: 201 });
    }

    if (access.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
    const email = payload.email?.trim().toLowerCase() ?? "";
    const role = payload.role === "admin" ? "admin" : payload.role === "employee" ? "employee" : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid employee email" }, { status: 400 });
    if (!role) return Response.json({ error: "Choose employee or administrator access" }, { status: 400 });
    const displayName = payload.displayName?.trim().slice(0, 100) || email;

    await access.db.insert(users).values({ email, displayName, role }).onConflictDoUpdate({ target: users.email, set: { displayName, role } });
    const [staffMember] = await access.db.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, createdAt: users.createdAt }).from(users).where(eq(users.email, email)).limit(1);
    return Response.json({ staffMember });
  } catch (error) {
    console.error("Operations staff access could not be saved", error);
    return Response.json({ error: "Employee access could not be saved" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    if (access.role !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });

    const payload = (await request.json()) as { email?: string };
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!email) return Response.json({ error: "Employee email is required" }, { status: 400 });
    if (email === access.user.email.toLowerCase()) return Response.json({ error: "You cannot remove your own administrator access" }, { status: 400 });

    const [existing] = await access.db.select({ role: users.role }).from(users).where(eq(users.email, email)).limit(1);
    if (!existing || !["employee", "admin"].includes(existing.role)) return Response.json({ error: "Operations user not found" }, { status: 404 });
    await access.db.update(users).set({ role: "homeowner" }).where(eq(users.email, email));
    return Response.json({ removed: true });
  } catch (error) {
    console.error("Operations staff access could not be removed", error);
    return Response.json({ error: "Employee access could not be removed" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireOperationsUser();
    if ("error" in access) return access.error;
    const payload = (await request.json()) as { id?: number; status?: string; risk?: string; assignee?: string; resolution?: string; note?: string; decision?: string };
    if (!Number.isInteger(payload.id)) return Response.json({ error: "Case id is required" }, { status: 400 });
    const [existing] = await access.db.select().from(operationsCases).where(eq(operationsCases.id, Number(payload.id))).limit(1);
    if (!existing) return Response.json({ error: "Case not found" }, { status: 404 });
    if (payload.status && !allowedStatuses.has(payload.status)) return Response.json({ error: "Invalid case status" }, { status: 400 });
    if (payload.risk && !allowedRisks.has(payload.risk)) return Response.json({ error: "Invalid risk level" }, { status: 400 });
    if (payload.decision && !allowedVerificationDecisions.has(payload.decision)) return Response.json({ error: "Invalid verification decision" }, { status: 400 });
    const caseDetails = JSON.parse(existing.details || "{}") as { ownerEmail?: string };
    if (payload.decision && (existing.caseType !== "verification" || !caseDetails.ownerEmail)) return Response.json({ error: "This case is not linked to a contractor profile" }, { status: 400 });
    const updates: Partial<typeof operationsCases.$inferInsert> = { updatedAt: new Date() };
    if (payload.status) updates.status = payload.status;
    if (payload.risk) updates.risk = payload.risk;
    if (typeof payload.assignee === "string") updates.assignee = payload.assignee.trim().slice(0, 80) || "Unassigned";
    if (typeof payload.resolution === "string") updates.resolution = payload.resolution.trim().slice(0, 2000);
    if (payload.decision === "approved") {
      updates.status = "resolved";
      updates.resolution = payload.resolution?.trim().slice(0, 2000) || "Contractor verification approved.";
    }
    if (payload.decision === "changes_requested") {
      updates.status = "waiting";
      updates.resolution = payload.resolution?.trim().slice(0, 2000) || "Additional verification information requested.";
    }
    if (payload.decision === "rejected") {
      updates.status = "resolved";
      updates.resolution = payload.resolution?.trim().slice(0, 2000) || "Contractor verification declined.";
    }
    await access.db.update(operationsCases).set(updates).where(eq(operationsCases.id, existing.id));
    if (payload.decision && caseDetails.ownerEmail) {
      await access.db.update(contractorProfiles).set({
        verificationStatus: payload.decision === "approved" ? "verified" : payload.decision === "rejected" ? "rejected" : "pending_review",
        acceptingWork: payload.decision === "approved",
        updatedAt: new Date(),
      }).where(eq(contractorProfiles.ownerEmail, caseDetails.ownerEmail));
    }
    if (payload.note?.trim()) await access.db.insert(operationsCaseNotes).values({ caseId: existing.id, authorEmail: access.user.email, body: payload.note.trim().slice(0, 2000) });
    const [updated] = await access.db.select().from(operationsCases).where(eq(operationsCases.id, existing.id)).limit(1);
    const notes = await access.db.select().from(operationsCaseNotes).where(eq(operationsCaseNotes.caseId, existing.id)).orderBy(desc(operationsCaseNotes.createdAt));
    return Response.json({ case: { ...updated, details: JSON.parse(updated.details || "{}"), notes } });
  } catch (error) {
    console.error("Operations case update failed", error);
    return Response.json({ error: "Case update failed" }, { status: 500 });
  }
}
