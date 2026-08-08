import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contractorProfiles, operationsCases, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const plans = new Set(["starter", "growth", "pro"]);
const serviceCategories = new Set(["Drywall", "Roofing", "Painting", "Plumbing", "Electrical", "HVAC", "Junk removal", "Landscaping", "Moving", "Carpentry", "Flooring", "General contracting"]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const [profile] = await getDb().select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
    return Response.json({ profile: profile ? { ...profile, services: JSON.parse(profile.services) } : null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const payload = (await request.json()) as {
      businessName?: string; legalName?: string; phone?: string; businessAddress?: string; yearsInBusiness?: number; about?: string; primaryService?: string;
      services?: string[]; homeBase?: string; serviceRadiusKm?: number; teamSize?: number;
      emergencyAvailable?: boolean; acceptingWork?: boolean; plan?: string;
    };
    const businessName = payload.businessName?.trim() ?? "";
    const primaryService = payload.primaryService?.trim() ?? "";
    const plan = payload.plan?.toLowerCase() ?? "growth";
    if (!businessName || !serviceCategories.has(primaryService) || !plans.has(plan)) return Response.json({ error: "Business name, primary service and a valid plan are required" }, { status: 400 });
    const radius = Math.min(100, Math.max(5, Number(payload.serviceRadiusKm) || 30));
    const teamSize = Math.min(500, Math.max(1, Number(payload.teamSize) || 1));
    const db = getDb();
    const [existingUser] = await db.select({ role: users.role }).from(users).where(eq(users.email, user.email)).limit(1);
    if (existingUser && ["employee", "admin"].includes(existingUser.role)) {
      await db.update(users).set({ displayName: user.displayName, activeWorkspace: "contractor" }).where(eq(users.email, user.email));
    } else {
      await db.insert(users).values({ email: user.email, displayName: user.displayName, role: "contractor", activeWorkspace: "contractor" }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName, role: "contractor", activeWorkspace: "contractor" } });
    }
    const values = {
      ownerEmail: user.email, businessName, legalName: payload.legalName?.trim() || businessName,
      phone: payload.phone?.trim() || "", businessAddress: payload.businessAddress?.trim() || "", yearsInBusiness: Math.min(200, Math.max(0, Number(payload.yearsInBusiness) || 0)), about: payload.about?.trim() || "", primaryService,
      services: JSON.stringify(Array.from(new Set([primaryService, ...(payload.services ?? [])].map((service) => service.trim()).filter(Boolean))).slice(0, 20)), homeBase: payload.homeBase?.trim() || "Hamilton, Ontario",
      serviceRadiusKm: radius, teamSize, emergencyAvailable: Boolean(payload.emergencyAvailable),
      acceptingWork: false, plan, verificationStatus: "pending_review", updatedAt: new Date(),
    };
    const [profile] = await db.insert(contractorProfiles).values(values).onConflictDoUpdate({ target: contractorProfiles.ownerEmail, set: values }).returning();
    try {
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
        evidenceCount: 0,
        dueLabel: "Due within 1 business day",
        details: JSON.stringify({ ownerEmail: profile.ownerEmail, primaryService: profile.primaryService, signals: ["Business profile submitted", "Identity and insurance review required"] }),
      }).onConflictDoUpdate({ target: operationsCases.externalId, set: {
        title: "Contractor application review",
        subject: profile.businessName,
        summary: `Verify ${profile.businessName} before enabling ${profile.primaryService.toLowerCase()} matching.`,
        risk: "low",
        priority: "normal",
        status: "open",
        assignee: "Unassigned",
        evidenceCount: 0,
        dueLabel: "Due within 1 business day",
        details: JSON.stringify({ ownerEmail: profile.ownerEmail, primaryService: profile.primaryService, signals: ["Business profile re-submitted", "Identity and insurance review required"] }),
        resolution: "",
        updatedAt: new Date(),
      } });
    } catch (error) {
      console.error("Verification case could not be queued", error);
    }
    return Response.json({ profile: { ...profile, services: JSON.parse(profile.services) } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const payload = (await request.json()) as { acceptingWork?: boolean; emergencyAvailable?: boolean; serviceRadiusKm?: number };
    const updates: { acceptingWork?: boolean; emergencyAvailable?: boolean; serviceRadiusKm?: number; updatedAt: Date } = { updatedAt: new Date() };
    if (payload.acceptingWork !== undefined) {
      if (payload.acceptingWork) {
        const [currentProfile] = await getDb().select({ verificationStatus: contractorProfiles.verificationStatus, subscriptionStatus: contractorProfiles.subscriptionStatus }).from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
        if (currentProfile?.verificationStatus !== "verified") return Response.json({ error: "Verification approval is required before accepting work" }, { status: 403 });
        if (!["active", "trialing", "demo_active"].includes(currentProfile.subscriptionStatus)) return Response.json({ error: "An active subscription is required before accepting work" }, { status: 403 });
      }
      updates.acceptingWork = Boolean(payload.acceptingWork);
    }
    if (payload.emergencyAvailable !== undefined) updates.emergencyAvailable = Boolean(payload.emergencyAvailable);
    if (payload.serviceRadiusKm !== undefined) updates.serviceRadiusKm = Math.min(100, Math.max(5, Number(payload.serviceRadiusKm) || 30));
    const [profile] = await getDb().update(contractorProfiles).set(updates).where(eq(contractorProfiles.ownerEmail, user.email)).returning();
    if (!profile) return Response.json({ error: "Complete contractor onboarding first" }, { status: 404 });
    return Response.json({ profile: { ...profile, services: JSON.parse(profile.services) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
