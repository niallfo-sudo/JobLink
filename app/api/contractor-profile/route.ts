import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contractorProfiles, users } from "../../../db/schema";
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
      businessName?: string; legalName?: string; phone?: string; about?: string; primaryService?: string;
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
    await db.insert(users).values({ email: user.email, displayName: user.displayName, role: "contractor" }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName, role: "contractor" } });
    const values = {
      ownerEmail: user.email, businessName, legalName: payload.legalName?.trim() || businessName,
      phone: payload.phone?.trim() || "", about: payload.about?.trim() || "", primaryService,
      services: JSON.stringify(Array.from(new Set([primaryService, ...(payload.services ?? [])].map((service) => service.trim()).filter(Boolean))).slice(0, 20)), homeBase: payload.homeBase?.trim() || "Hamilton, Ontario",
      serviceRadiusKm: radius, teamSize, emergencyAvailable: Boolean(payload.emergencyAvailable),
      acceptingWork: payload.acceptingWork !== false, plan, verificationStatus: "pending_review", updatedAt: new Date(),
    };
    const [profile] = await db.insert(contractorProfiles).values(values).onConflictDoUpdate({ target: contractorProfiles.ownerEmail, set: values }).returning();
    return Response.json({ profile: { ...profile, services: JSON.parse(profile.services) } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  try {
    const payload = (await request.json()) as { plan?: string; acceptingWork?: boolean; emergencyAvailable?: boolean; serviceRadiusKm?: number };
    const updates: { plan?: string; acceptingWork?: boolean; emergencyAvailable?: boolean; serviceRadiusKm?: number; updatedAt: Date } = { updatedAt: new Date() };
    if (payload.plan !== undefined) {
      const plan = payload.plan.toLowerCase();
      if (!plans.has(plan)) return Response.json({ error: "Invalid plan" }, { status: 400 });
      updates.plan = plan;
    }
    if (payload.acceptingWork !== undefined) updates.acceptingWork = Boolean(payload.acceptingWork);
    if (payload.emergencyAvailable !== undefined) updates.emergencyAvailable = Boolean(payload.emergencyAvailable);
    if (payload.serviceRadiusKm !== undefined) updates.serviceRadiusKm = Math.min(100, Math.max(5, Number(payload.serviceRadiusKm) || 30));
    const [profile] = await getDb().update(contractorProfiles).set(updates).where(eq(contractorProfiles.ownerEmail, user.email)).returning();
    if (!profile) return Response.json({ error: "Complete contractor onboarding first" }, { status: 404 });
    return Response.json({ profile: { ...profile, services: JSON.parse(profile.services) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
  }
}
