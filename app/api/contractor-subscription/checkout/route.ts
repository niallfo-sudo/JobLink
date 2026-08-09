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

export async function POST(request: Request) {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { plan?: "starter" | "growth" | "pro" };
  if (!payload.plan || !["starter", "growth", "pro"].includes(payload.plan)) return Response.json({ error: "Choose a valid plan" }, { status: 400 });
  const db = getDb();
  const [profile] = await db.select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
  if (!profile) return Response.json({ error: "Complete contractor onboarding first" }, { status: 409 });
  const [updated] = await db.update(contractorProfiles).set({ plan: payload.plan, subscriptionStatus: "demo_active", updatedAt: new Date() }).where(eq(contractorProfiles.ownerEmail, user.email)).returning();
  return Response.json({ profile: { ...updated, services: parseServices(updated.services), approvedServices: parseServices(updated.approvedServices) }, demo: true, message: "Demo subscription activated. No payment method was charged." });
}
