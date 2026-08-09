import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../db";
import { contractorProfiles, users } from "../../../db/schema";
import { DEMO_CONTRACTOR_COOKIE } from "../../contractor-demo";
import { getChatGPTUser } from "../../chatgpt-auth";

function cookie(value: string, maxAge = 60 * 60 * 8) {
  return `${DEMO_CONTRACTOR_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

async function demoAdmin() {
  const identity = await getChatGPTUser();
  if (!identity) return null;
  const [account] = await getDb().select({ role: users.role }).from(users).where(eq(users.email, identity.email)).limit(1);
  return account?.role === "admin" ? identity : null;
}

export async function GET() {
  const identity = await demoAdmin();
  if (!identity) return Response.json({ companies: [], enabled: false });
  const rows = await getDb().select({ ownerEmail: contractorProfiles.ownerEmail, businessName: contractorProfiles.businessName, primaryService: contractorProfiles.primaryService, homeBase: contractorProfiles.homeBase, verificationStatus: contractorProfiles.verificationStatus })
    .from(contractorProfiles)
    .orderBy(asc(contractorProfiles.businessName));
  const selectedEmail = (await cookies()).get(DEMO_CONTRACTOR_COOKIE)?.value || identity.email;
  return Response.json({ companies: rows, selectedEmail, enabled: true });
}

export async function POST(request: Request) {
  const identity = await demoAdmin();
  if (!identity) return Response.json({ error: "Demo company switching is available to Operations administrators only" }, { status: 403 });
  const payload = (await request.json()) as { contractorEmail?: string | null };
  const selectedEmail = payload.contractorEmail?.trim() || "";
  if (!selectedEmail || selectedEmail === identity.email) {
    return Response.json({ selectedEmail: identity.email }, { headers: { "Set-Cookie": cookie("", 0) } });
  }
  const [profile] = await getDb().select({ ownerEmail: contractorProfiles.ownerEmail }).from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, selectedEmail)).limit(1);
  if (!profile) return Response.json({ error: "That contractor company is unavailable" }, { status: 404 });
  return Response.json({ selectedEmail }, { headers: { "Set-Cookie": cookie(selectedEmail) } });
}
