import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { contractorProfiles } from "../../../../db/schema";
import { getContractorActor } from "../../../contractor-demo";

export async function POST() {
  const user = await getContractorActor();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const [profile] = await getDb().select().from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, user.email)).limit(1);
  if (!profile) return Response.json({ error: "Complete contractor onboarding first" }, { status: 409 });
  return Response.json({ profile, demo: true, message: "Billing is in demo mode. Choose another plan to simulate a plan change." });
}
