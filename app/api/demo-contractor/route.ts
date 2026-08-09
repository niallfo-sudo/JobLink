import { asc, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "../../../db";
import { contractorProfiles, users } from "../../../db/schema";
import { DEMO_CONTRACTOR_COOKIE } from "../../contractor-demo";
import { getChatGPTUser } from "../../chatgpt-auth";

function cookie(value: string, maxAge = 60 * 60 * 8) {
  return `${DEMO_CONTRACTOR_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

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

export async function ensureGeneralContractorsDemo() {
  await getDb().insert(contractorProfiles).values({
    ownerEmail: "demo-general-contractors@joblink.demo",
    businessName: "General Contractors Inc.",
    legalName: "General Contractors Inc.",
    phone: "905-555-0118",
    businessAddress: "Hamilton, Ontario",
    yearsInBusiness: 15,
    about: "Full-service residential renovations, basements, kitchens, bathrooms and project management.",
    primaryService: "General contracting",
    services: '["General contracting", "Renovations", "Basements", "Kitchens", "Bathrooms", "Additions", "Project management"]',
    approvedServices: '["General contracting", "Renovations", "Basements", "Kitchens", "Bathrooms", "Additions", "Project management"]',
    homeBase: "Hamilton, Ontario",
    serviceRadiusKm: 50,
    teamSize: 8,
    acceptingWork: true,
    plan: "pro",
    subscriptionStatus: "demo_active",
    payoutsEnabled: true,
    verificationStatus: "verified",
  }).onConflictDoNothing();
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
  await ensureGeneralContractorsDemo();
  const rows = await getDb().select({ ownerEmail: contractorProfiles.ownerEmail, businessName: contractorProfiles.businessName, primaryService: contractorProfiles.primaryService, homeBase: contractorProfiles.homeBase, verificationStatus: contractorProfiles.verificationStatus })
    .from(contractorProfiles)
    .orderBy(asc(contractorProfiles.businessName));
  const selectedEmail = (await cookies()).get(DEMO_CONTRACTOR_COOKIE)?.value || identity.email;
  const companies = rows.filter((profile) => profile.businessName.trim() && profile.verificationStatus !== "rejected");
  return Response.json({ companies, selectedEmail, enabled: true });
}

export async function POST(request: Request) {
  const identity = await demoAdmin();
  if (!identity) return Response.json({ error: "Demo company switching is available to Operations administrators only" }, { status: 403 });
  const payload = (await request.json()) as { action?: "create"; contractorEmail?: string | null };
  if (payload.action === "create") {
    const ownerEmail = `demo-contractor-${crypto.randomUUID().slice(0, 8)}@joblink.demo`;
    const [profile] = await getDb().insert(contractorProfiles).values({
      ownerEmail,
      businessName: "",
      legalName: "",
      phone: "",
      businessAddress: "",
      yearsInBusiness: 0,
      about: "",
      primaryService: "General contracting",
      services: "[]",
      approvedServices: "[]",
      homeBase: "",
      serviceRadiusKm: 30,
      teamSize: 1,
      emergencyAvailable: false,
      acceptingWork: false,
      plan: "growth",
      subscriptionStatus: "inactive",
      payoutsEnabled: false,
      verificationStatus: "pending",
    }).returning();
    return Response.json({ profile: serializeProfile(profile), selectedEmail: ownerEmail }, { status: 201, headers: { "Set-Cookie": cookie(ownerEmail) } });
  }
  const selectedEmail = payload.contractorEmail?.trim() || "";
  if (!selectedEmail || selectedEmail === identity.email) {
    return Response.json({ selectedEmail: identity.email }, { headers: { "Set-Cookie": cookie("", 0) } });
  }
  const [profile] = await getDb().select({ ownerEmail: contractorProfiles.ownerEmail }).from(contractorProfiles).where(eq(contractorProfiles.ownerEmail, selectedEmail)).limit(1);
  if (!profile) return Response.json({ error: "That contractor company is unavailable" }, { status: 404 });
  return Response.json({ selectedEmail }, { headers: { "Set-Cookie": cookie(selectedEmail) } });
}
