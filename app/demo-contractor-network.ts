import { getDb } from "../db";
import { contractorProfiles } from "../db/schema";

export type DemoContractorMetrics = {
  averageRating: number;
  jobLinkScore: number;
  completedJobs: number;
  quoteRating: number;
  releasedPayoutCents: number;
};

export type DemoContractor = DemoContractorMetrics & {
  ownerEmail: string;
  businessName: string;
  service: string;
  yearsInBusiness: number;
  teamSize: number;
  about: string;
};

const names: Record<string, [string, string, string]> = {
  Drywall: ["Hamilton WallWorks", "Precision Drywall Co.", "TrueNorth Board & Finish"],
  Roofing: ["Golden Hammer Roofing", "Summit Roof Systems", "Steel City Roofing Co."],
  Painting: ["Brush & Beam Painting", "Hamilton Paintworks", "True Coat Painters"],
  Plumbing: ["Red Seal Plumbing Co.", "Harbour City Plumbing", "Pipewise Mechanical"],
  Electrical: ["BrightLine Electrical", "Hamilton Circuit Co.", "Northstar Electric"],
  HVAC: ["Comfort First HVAC", "Steel City Heating & Air", "TrueTemp Mechanical"],
  "Junk removal": ["ClearSpace Junk Removal", "Hammer City Haul Away", "Good Sort Disposal"],
  Landscaping: ["Greenline Landscaping", "Cedar & Stone Outdoor", "Hamilton Yard Co."],
  Moving: ["Harbour Move Co.", "Hamilton Home Movers", "Careful Carry Moving"],
  Carpentry: ["Craftline Carpentry", "True Joint Woodworks", "Hamilton Finish Carpentry"],
  Flooring: ["LevelLine Flooring", "Hamilton Floor Co.", "TrueStep Installations"],
  "General contracting": ["General Contractors Inc.", "Hamilton Home Renos", "Buildwell Contracting"],
};

const metricSets: DemoContractorMetrics[] = [
  { averageRating: 4.9, jobLinkScore: 96, completedJobs: 184, quoteRating: 95, releasedPayoutCents: 824_600 },
  { averageRating: 4.8, jobLinkScore: 93, completedJobs: 126, quoteRating: 92, releasedPayoutCents: 568_400 },
  { averageRating: 4.7, jobLinkScore: 90, completedJobs: 88, quoteRating: 89, releasedPayoutCents: 391_200 },
];

function emailFor(service: string, position: number) {
  if (service === "General contracting" && position === 0) return "demo-general-contractors@joblink.demo";
  return `demo-${service.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/^-|-$/g, "")}-${position + 1}@joblink.demo`;
}

function makeContractor(service: string, position: number): DemoContractor {
  const metric = metricSets[position];
  const businessName = names[service][position];
  return {
    ...metric,
    ownerEmail: emailFor(service, position),
    businessName,
    service,
    yearsInBusiness: 8 + position * 4,
    teamSize: 4 + position * 3,
    about: `${businessName} is a verified Hamilton ${service.toLowerCase()} company with a documented record of completed JobLink work.`,
  };
}

export const demoContractors = Object.entries(names).flatMap(([service]) => [0, 1, 2].map((position) => makeContractor(service, position)));

export function demoContractorsForService(service: string) {
  return demoContractors.filter((contractor) => contractor.service === service);
}

export function demoContractorMetrics(ownerEmail: string | null | undefined) {
  return demoContractors.find((contractor) => contractor.ownerEmail === ownerEmail) ?? null;
}

export async function ensureDemoContractorsForService(service: string) {
  const contractors = demoContractorsForService(service);
  if (!contractors.length) return contractors;
  const db = getDb();
  await Promise.all(contractors.map((contractor) => db.insert(contractorProfiles).values({
    ownerEmail: contractor.ownerEmail,
    businessName: contractor.businessName,
    legalName: contractor.businessName,
    phone: "905-555-0140",
    businessAddress: "Hamilton, Ontario",
    yearsInBusiness: contractor.yearsInBusiness,
    about: contractor.about,
    primaryService: contractor.service,
    services: JSON.stringify([contractor.service]),
    approvedServices: JSON.stringify([contractor.service]),
    homeBase: "Hamilton, Ontario",
    serviceRadiusKm: 50,
    teamSize: contractor.teamSize,
    acceptingWork: true,
    plan: "pro",
    subscriptionStatus: "demo_active",
    payoutsEnabled: true,
    verificationStatus: "verified",
  }).onConflictDoNothing()));
  return contractors;
}

export async function ensureDemoContractorNetwork() {
  await Promise.all(Object.keys(names).map((service) => ensureDemoContractorsForService(service)));
}

export function createDemoQuote(job: { id: number; title: string; description: string; size: string; timeline: string }, contractor: DemoContractor, position: number) {
  const textWeight = Math.min(1_700, job.description.length * 13 + job.size.length * 9);
  const serviceWeight = contractor.service === "General contracting" ? 3_800 : contractor.service === "Roofing" || contractor.service === "HVAC" ? 2_250 : 1_150;
  const centre = Math.round((serviceWeight + textWeight) * [0.94, 1.03, 1.12][position]);
  const width = [0.12, 0.15, 0.18][position];
  const minAmount = Math.max(400, Math.round(centre * (1 - width)));
  const maxAmount = Math.round(centre * (1 + width));
  const start = new Date();
  start.setDate(start.getDate() + 5 + position * 3);
  const completion = ["About 2–4 days", "About 1 week", "About 1–2 weeks"][position];
  return {
    jobId: job.id,
    contractorEmail: contractor.ownerEmail,
    contractorName: contractor.businessName,
    amountCents: centre * 100,
    initialMinCents: minAmount * 100,
    initialMaxCents: maxAmount * 100,
    message: `Demo preliminary estimate for ${job.title}. Includes an initial review of the requested ${contractor.service.toLowerCase()} work and a clear on-site confirmation before any final price. Estimated completion timeframe: ${completion}.`,
    availableAt: "On-site visit available within 2 business days",
    estimatedStartAt: start,
    status: "submitted",
  };
}
