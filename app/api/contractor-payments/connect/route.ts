import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { contractorProfiles } from "../../../../db/schema";
import { getContractorActor } from "../../../contractor-demo";

function parseServices(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((service): service is string => typeof service === "string") : [];
  } catch {
    return [];
  }
}

function serializeProfile<T extends { services: string; approvedServices: string | null }>(profile: T) {
  return {
    ...profile,
    services: parseServices(profile.services),
    approvedServices: parseServices(profile.approvedServices),
  };
}

export async function POST() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const db = getDb();
  const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
  if (!profile) return Response.json({ error: "Complete contractor onboarding first" }, { status: 409 });
  const demoAccountId = profile.stripeConnectAccountId || `demo_${crypto.randomUUID()}`;
  const [updated] = await db.update(contractorProfiles).set({ stripeConnectAccountId: demoAccountId, payoutsEnabled: true, updatedAt: new Date() }).where(eq(contractorProfiles.ownerEmail, user.email)).returning();
  return Response.json({ connected: true, payoutsEnabled: true, profile: serializeProfile(updated), demo: true, message: "Demo payout destination enabled. No bank account was connected." });
}

export async function GET() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const [profile] = await getDb().select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
  return Response.json({ connected: Boolean(profile?.stripeConnectAccountId), payoutsEnabled: Boolean(profile?.payoutsEnabled), demo: true });
}
