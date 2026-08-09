import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { contractorProfiles, contractorVerificationDocuments, jobAttachments, jobEvents, jobRequests, operationsCaseNotes, operationsCases, paymentMilestones, paymentRecords, quotes, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { env } from "cloudflare:workers";
import { notify } from "../../../lib/notifications";

const allowedStatuses = new Set(["open", "in_review", "waiting", "resolved", "dismissed"]);
const allowedRisks = new Set(["low", "medium", "high", "critical"]);
const allowedVerificationDecisions = new Set(["approved", "changes_requested", "rejected"]);

function profileServices(profile: typeof contractorProfiles.$inferSelect) {
  return Array.from(new Set([profile.primaryService, ...(JSON.parse(profile.services || "[]") as string[])]));
}

function approvedProfileServices(profile: typeof contractorProfiles.$inferSelect) {
  return JSON.parse(profile.approvedServices || "[]") as string[];
}

type UploadBucket = { delete(keys: string | string[]): Promise<void> };

function uploadsBucket() {
  const binding = (env as unknown as { UPLOADS?: UploadBucket }).UPLOADS;
  if (!binding) throw new Error("Upload storage is unavailable");
  return binding;
}

function contractorMatchesJob(profile: typeof contractorProfiles.$inferSelect, job: typeof jobRequests.$inferSelect) {
  if (profile.verificationStatus !== "verified" || !["active", "trialing", "demo_active"].includes(profile.subscriptionStatus) || !profile.acceptingWork) return false;
  if (job.emergency && !profile.emergencyAvailable) return false;
  const category = job.category.toLowerCase();
  const services = approvedProfileServices(profile).map((service) => service.toLowerCase());
  return services.includes(category);
}

async function requireOperationsUser() {
  const user = await getChatGPTUser();
  if (!user) return { error: Response.json({ error: "Sign in required" }, { status: 401 }) };
  const db = getDb();
  let [record] = await db.select({ role: users.role }).from(users).where(eq(users.email, user.email)).limit(1);
  const [staffCount] = await db.select({ value: sql<number>`count(*)` }).from(users).where(inArray(users.role, ["employee", "admin"]));
  if (!staffCount?.value) {
    const bootstrapAdmins = ((env as unknown as { JOBLINK_ADMIN_EMAILS?: string }).JOBLINK_ADMIN_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (bootstrapAdmins.includes(user.email.toLowerCase())) {
      await db.insert(users).values({ email: user.email, displayName: user.displayName, role: "admin" }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName, role: "admin" } });
      record = { role: "admin" };
    }
  }
  if (!record || !["employee", "admin"].includes(record.role)) return { error: Response.json({ error: "Employee access required" }, { status: 403 }) };
  return { user, db, role: record.role };
}

async function syncPendingVerificationCases(db: ReturnType<typeof getDb>) {
  const pendingProfiles = await db.select().from(contractorProfiles).where(inArray(contractorProfiles.verificationStatus, ["pending", "pending_review"]));
  for (const profile of pendingProfiles) {
    const documents = await db.select({ id: contractorVerificationDocuments.id, documentType: contractorVerificationDocuments.documentType, filename: contractorVerificationDocuments.filename, contentType: contractorVerificationDocuments.contentType, reviewStatus: contractorVerificationDocuments.reviewStatus }).from(contractorVerificationDocuments).where(eq(contractorVerificationDocuments.ownerEmail, profile.ownerEmail));
    const externalId = `VR-P${profile.id}`;
    const [existingCase] = await db.select({ status: operationsCases.status, assignee: operationsCases.assignee, resolution: operationsCases.resolution }).from(operationsCases).where(eq(operationsCases.externalId, externalId)).limit(1);
    const shouldReopen = Boolean(existingCase && ["resolved", "dismissed"].includes(existingCase.status));
    await db.insert(operationsCases).values({
      externalId,
      caseType: "verification",
      title: "Contractor application review",
      subject: profile.businessName,
      summary: `Verify ${profile.businessName} before enabling ${profile.primaryService.toLowerCase()} matching.`,
      risk: "low",
      priority: "normal",
      status: shouldReopen ? "open" : existingCase?.status || "open",
      assignee: shouldReopen ? "Unassigned" : existingCase?.assignee || "Unassigned",
      evidenceCount: documents.length,
      dueLabel: "Due within 1 business day",
      details: JSON.stringify({ ownerEmail: profile.ownerEmail, primaryService: profile.primaryService, requestedServices: profileServices(profile), signals: ["Business profile submitted", `${documents.length} verification document${documents.length === 1 ? "" : "s"} uploaded`], documents }),
    }).onConflictDoUpdate({ target: operationsCases.externalId, set: {
      title: "Contractor application review",
      subject: profile.businessName,
      summary: `Verify ${profile.businessName} before enabling ${profile.primaryService.toLowerCase()} matching.`,
      status: shouldReopen ? "open" : existingCase?.status || "open",
      assignee: shouldReopen ? "Unassigned" : existingCase?.assignee || "Unassigned",
      evidenceCount: documents.length,
      dueLabel: "Due within 1 business day",
      details: JSON.stringify({ ownerEmail: profile.ownerEmail, primaryService: profile.primaryService, requestedServices: profileServices(profile), signals: ["Business profile submitted", `${documents.length} verification document${documents.length === 1 ? "" : "s"} uploaded`], documents }),
      resolution: shouldReopen ? "" : existingCase?.resolution || "",
      updatedAt: new Date(),
    } });
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
    const paymentReviewRows = await access.db.select({ milestone: paymentMilestones, payment: paymentRecords, job: { externalId: jobRequests.externalId, title: jobRequests.title } }).from(paymentMilestones).innerJoin(paymentRecords, eq(paymentMilestones.paymentId, paymentRecords.id)).innerJoin(jobRequests, eq(paymentMilestones.jobId, jobRequests.id)).where(inArray(paymentMilestones.status, ["proof_submitted", "operations_hold"])).orderBy(desc(paymentMilestones.updatedAt));
    const paymentReviewJobIds = [...new Set(paymentReviewRows.map((row) => row.milestone.jobId))];
    const paymentReviewPhotos = paymentReviewJobIds.length ? await access.db.select({ id: jobAttachments.id, jobId: jobAttachments.jobId, milestoneId: jobAttachments.milestoneId, filename: jobAttachments.filename, contentType: jobAttachments.contentType, kind: jobAttachments.kind, stage: jobAttachments.stage }).from(jobAttachments).where(inArray(jobAttachments.jobId, paymentReviewJobIds)) : [];
    const reviewPhoto = (attachment: typeof paymentReviewPhotos[number]) => ({ ...attachment, url: `/api/jobs/${attachment.jobId}/attachments/${attachment.id}` });
    const staff = await access.db.select({ id: users.id, email: users.email, displayName: users.displayName, role: users.role, createdAt: users.createdAt }).from(users).where(inArray(users.role, ["employee", "admin"]));
    const verifiedContractors = await access.db.select().from(contractorProfiles).where(eq(contractorProfiles.verificationStatus, "verified")).orderBy(desc(contractorProfiles.updatedAt));
    const operationsJobs = await access.db.select().from(jobRequests).orderBy(desc(jobRequests.updatedAt)).limit(100);
    const operationQuotes = operationsJobs.length ? await access.db.select({ id: quotes.id, jobId: quotes.jobId, contractorEmail: quotes.contractorEmail, contractorName: quotes.contractorName, amountCents: quotes.amountCents, status: quotes.status, createdAt: quotes.createdAt }).from(quotes).where(inArray(quotes.jobId, operationsJobs.map((job) => job.id))).orderBy(desc(quotes.createdAt)) : [];
    return Response.json({
      viewer: { email: access.user.email, displayName: access.user.displayName, role: access.role },
      staff,
      cases: cases.map((item) => ({ ...item, details: JSON.parse(item.details || "{}"), notes: notes.filter((note) => note.caseId === item.id) })),
      verifiedContractors: verifiedContractors.map((profile) => ({
        id: profile.id,
        ownerEmail: profile.ownerEmail,
        businessName: profile.businessName,
        primaryService: profile.primaryService,
        requestedServices: profileServices(profile),
        approvedServices: approvedProfileServices(profile),
        homeBase: profile.homeBase,
        serviceRadiusKm: profile.serviceRadiusKm,
        teamSize: profile.teamSize,
        emergencyAvailable: profile.emergencyAvailable,
        acceptingWork: profile.acceptingWork,
        plan: profile.plan,
        subscriptionStatus: profile.subscriptionStatus,
        payoutsEnabled: profile.payoutsEnabled,
        updatedAt: profile.updatedAt,
      })),
      jobs: operationsJobs.map((job) => {
        const matchingContractors = verifiedContractors.filter((profile) => contractorMatchesJob(profile, job)).map((profile) => ({ businessName: profile.businessName, ownerEmail: profile.ownerEmail, primaryService: profile.primaryService }));
        const jobQuotes = operationQuotes.filter((quote) => quote.jobId === job.id);
        return {
          id: job.id,
          externalId: job.externalId,
          ownerEmail: job.ownerEmail,
          category: job.category,
          title: job.title,
          budget: job.budget,
          timeline: job.timeline,
          emergency: job.emergency,
          status: job.status,
          scheduledStartAt: job.scheduledStartAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          matchingContractors,
          quotes: jobQuotes,
        };
      }),
      paymentReviews: paymentReviewRows.map((row) => ({ ...row.milestone, externalId: row.job.externalId, jobTitle: row.job.title, contractorName: row.payment.contractorName, preWorkPhotos: paymentReviewPhotos.filter((attachment) => attachment.jobId === row.milestone.jobId && attachment.stage === "pre_work" && attachment.kind === "image").map(reviewPhoto), progressPhotos: paymentReviewPhotos.filter((attachment) => attachment.milestoneId === row.milestone.id && attachment.stage === "progress" && attachment.kind === "image").map(reviewPhoto) })),
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
    const payload = (await request.json()) as { action?: string; confirmation?: string; ownerEmail?: string; approvedServices?: string[]; email?: string; displayName?: string; role?: string; caseType?: string; title?: string; subject?: string; summary?: string; risk?: string; priority?: string; dueLabel?: string; milestoneId?: number; decision?: "hold" | "clear"; reason?: string };
    if (payload.action === "clear_job_postings") {
      if (access.role !== "admin") return Response.json({ error: "Administrator access is required to clear marketplace jobs" }, { status: 403 });
      if (payload.confirmation !== "CLEAR JOBS") return Response.json({ error: "Type CLEAR JOBS to confirm the marketplace reset" }, { status: 400 });
      const attachments = await access.db.select({ storageKey: jobAttachments.storageKey }).from(jobAttachments);
      if (attachments.length) await uploadsBucket().delete(attachments.map((attachment) => attachment.storageKey));
      const deletedJobs = await access.db.delete(jobRequests).returning({ id: jobRequests.id });
      return Response.json({ deletedJobs: deletedJobs.length });
    }
    if (payload.action === "update_approved_services") {
      const ownerEmail = payload.ownerEmail?.trim().toLowerCase() || "";
      if (!ownerEmail || !Array.isArray(payload.approvedServices)) return Response.json({ error: "Choose a contractor and at least one approved service" }, { status: 400 });
      const [profile] = await access.db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, ownerEmail)).limit(1);
      if (!profile) return Response.json({ error: "Contractor profile not found" }, { status: 404 });
      const requested = new Set(profileServices(profile));
      const approved = Array.from(new Set(payload.approvedServices.map((service) => service.trim()).filter((service) => requested.has(service))));
      if (!approved.length) return Response.json({ error: "Select at least one service the contractor requested" }, { status: 400 });
      const [updated] = await access.db.update(contractorProfiles).set({ approvedServices: JSON.stringify(approved), updatedAt: new Date() }).where(eq(contractorProfiles.id, profile.id)).returning();
      return Response.json({ profile: { id: updated.id, ownerEmail: updated.ownerEmail, approvedServices: approved } });
    }
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

    if (payload.action === "payment_milestone_review") {
      const milestoneId = Number(payload.milestoneId);
      const reason = payload.reason?.trim().slice(0, 1000) || "";
      if (!Number.isInteger(milestoneId) || !payload.decision) return Response.json({ error: "A payment milestone and review decision are required" }, { status: 400 });
      if (reason.length < 5) return Response.json({ error: "Add a short Operations review note" }, { status: 400 });
      const [milestone] = await access.db.select().from(paymentMilestones).where(eq(paymentMilestones.id, milestoneId)).limit(1);
      if (!milestone) return Response.json({ error: "Payment milestone not found" }, { status: 404 });
      if (payload.decision === "hold" && milestone.status !== "proof_submitted") return Response.json({ error: "Only submitted proof can be placed on hold" }, { status: 409 });
      if (payload.decision === "clear" && milestone.status !== "operations_hold") return Response.json({ error: "Only a held release can be cleared" }, { status: 409 });
      const [payment] = await access.db.select().from(paymentRecords).where(eq(paymentRecords.id, milestone.paymentId)).limit(1);
      const [job] = await access.db.select().from(jobRequests).where(eq(jobRequests.id, milestone.jobId)).limit(1);
      if (!payment || !job) return Response.json({ error: "Payment job context not found" }, { status: 404 });
      const now = new Date();
      const nextStatus = payload.decision === "hold" ? "operations_hold" : "proof_submitted";
      const [updatedMilestone] = await access.db.update(paymentMilestones).set({ status: nextStatus, operationsReviewedBy: access.user.email, operationsReviewedAt: now, operationsNote: reason, updatedAt: now }).where(eq(paymentMilestones.id, milestone.id)).returning();
      await access.db.insert(jobEvents).values({ jobId: job.id, eventType: payload.decision === "hold" ? "payment_release_held" : "payment_release_cleared", label: `Operations ${payload.decision === "hold" ? "held" : "cleared"} the ${milestone.label.toLowerCase()} release`, metadata: JSON.stringify({ milestoneId, reviewedBy: access.user.email, reason }) });
      await notify(job.ownerEmail, { jobId: job.id, type: payload.decision === "hold" ? "payment_release_held" : "payment_release_cleared", title: payload.decision === "hold" ? "Payment release under review" : "Payment release cleared", body: `${job.externalId}: Operations ${payload.decision === "hold" ? "placed the release on hold" : "cleared the release for homeowner approval"}.` });
      if (payment.contractorEmail) await notify(payment.contractorEmail, { jobId: job.id, type: payload.decision === "hold" ? "payment_release_held" : "payment_release_cleared", title: payload.decision === "hold" ? "Payment release under review" : "Payment release cleared", body: `${job.externalId}: ${reason}` });
      return Response.json({ milestone: updatedMilestone });
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
    const payload = (await request.json()) as { id?: number; status?: string; risk?: string; assignee?: string; resolution?: string; note?: string; decision?: string; approvedServices?: string[] };
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
      const [profile] = await access.db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, caseDetails.ownerEmail)).limit(1);
      if (!profile) return Response.json({ error: "Contractor profile not found" }, { status: 404 });
      const requested = new Set(profileServices(profile));
      const proposedServices = Array.isArray(payload.approvedServices) ? payload.approvedServices : profileServices(profile);
      const approved = Array.from(new Set(proposedServices.map((service) => service.trim()).filter((service) => requested.has(service))));
      if (payload.decision === "approved" && !approved.length) return Response.json({ error: "Approve at least one requested service before enabling matching" }, { status: 400 });
      await access.db.update(contractorProfiles).set({
        verificationStatus: payload.decision === "approved" ? "verified" : payload.decision === "rejected" ? "rejected" : "pending_review",
        approvedServices: payload.decision === "approved" ? JSON.stringify(approved) : undefined,
        acceptingWork: payload.decision === "approved" ? undefined : false,
        updatedAt: new Date(),
      }).where(eq(contractorProfiles.ownerEmail, caseDetails.ownerEmail));
      await access.db.update(contractorVerificationDocuments).set({ reviewStatus: payload.decision === "approved" ? "approved" : payload.decision === "rejected" ? "rejected" : "changes_requested" }).where(eq(contractorVerificationDocuments.ownerEmail, caseDetails.ownerEmail));
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
