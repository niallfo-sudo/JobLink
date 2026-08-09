import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { contractorProfiles, users } from "../db/schema";
import { getChatGPTUser, type ChatGPTUser } from "./chatgpt-auth";

export const DEMO_CONTRACTOR_COOKIE = "joblink_demo_contractor";
export const DEMO_CONTRACTOR_EMAIL_SUFFIX = "@joblink.demo";

export function isDemoContractorEmail(email: string) {
  return email.endsWith(DEMO_CONTRACTOR_EMAIL_SUFFIX);
}

/**
 * Returns the selected demo contractor for an Operations administrator.
 * Everyone else continues to act only as their authenticated account.
 */
export async function getContractorActor(): Promise<ChatGPTUser | null> {
  const identity = await getChatGPTUser();
  if (!identity) return null;

  const selectedEmail = (await cookies()).get(DEMO_CONTRACTOR_COOKIE)?.value;
  if (!selectedEmail || !isDemoContractorEmail(selectedEmail)) return identity;

  const db = getDb();
  const [account] = await db.select({ role: users.role }).from(users).where(eq(users.email, identity.email)).limit(1);
  if (account?.role !== "admin") return identity;

  const [profile] = await db.select({ ownerEmail: contractorProfiles.ownerEmail, businessName: contractorProfiles.businessName })
    .from(contractorProfiles)
    .where(eq(contractorProfiles.ownerEmail, selectedEmail))
    .limit(1);
  if (!profile) return identity;

  return { ...identity, email: profile.ownerEmail, displayName: profile.businessName, fullName: profile.businessName };
}
