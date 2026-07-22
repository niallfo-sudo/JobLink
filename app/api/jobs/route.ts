import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobEvents, jobRequests, quotes, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const quoteProviderNames: Record<string, string[]> = {
  Drywall: ["North & Beam Drywall", "Hamilton Plaster Co.", "Level Finish Inc."],
  Roofing: ["Peakline Roofing", "Harbour Roofworks", "Escarpment Exteriors"],
  Painting: ["Brightline Painting", "True Colour Hamilton", "Finish & Field Painting"],
  Plumbing: ["Harbour Plumbing", "Bluebird Plumbing", "Hamilton Flow & Drain"],
  Electrical: ["Lakeshore Electric", "Northcrest Electric", "Current Works Hamilton"],
  HVAC: ["Maple Air & Heat", "Hamilton Climate Co.", "Comfortline Mechanical"],
  "Junk removal": ["ClearOut Hamilton", "Hammer City Haul", "Green Bin Crew"],
  Landscaping: ["Escarpment Landscapes", "Greenline Outdoor", "Hamilton Yardworks"],
  Moving: ["Steel City Moving", "Harbour Movers", "Careful Hands Hamilton"],
  Carpentry: ["Grain & Beam Carpentry", "Hamilton Finish Works", "Red Oak Custom"],
  Flooring: ["Level Ground Flooring", "Hamilton Floor Co.", "Plank & Tile Works"],
  "General contracting": ["Citywide Renovations", "Hamilton Build Group", "True North Contracting"],
};

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const databaseUnavailable = message.includes("no such table") || message.includes("D1 binding");
  return Response.json({ error: databaseUnavailable ? "Job storage is being prepared. Please try again shortly." : message }, { status: 500 });
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const jobs = await getDb().select().from(jobRequests).where(eq(jobRequests.ownerEmail, user.email)).orderBy(desc(jobRequests.createdAt)).limit(20);
    return Response.json({ jobs });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  try {
    const payload = (await request.json()) as {
      category?: string; title?: string; description?: string; size?: string;
      timeline?: string; budget?: string; postalCode?: string; emergency?: boolean;
    };
    const category = payload.category?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const description = payload.description?.trim() ?? "";
    if (!category || !title || !description) {
      return Response.json({ error: "Category, title and description are required" }, { status: 400 });
    }

    const db = getDb();
    await db.insert(users).values({ email: user.email, displayName: user.displayName }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName } });
    const externalId = `JL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [job] = await db.insert(jobRequests).values({
      externalId, ownerEmail: user.email, category, title, description,
      size: payload.size?.trim() || "Not specified",
      timeline: payload.timeline?.trim() || "Flexible",
      budget: payload.budget?.trim() || "Need guidance",
      postalCode: payload.postalCode?.trim() || "",
      emergency: Boolean(payload.emergency),
    }).returning();

    await db.insert(jobEvents).values({ jobId: job.id, eventType: "request_created", label: "Request submitted for matching", metadata: JSON.stringify({ category }) });
    const providerNames = quoteProviderNames[category] ?? quoteProviderNames.Drywall;
    await db.insert(quotes).values([
      { jobId: job.id, contractorName: providerNames[0], amountCents: 228000, availableAt: "Tomorrow, 8–10 AM", message: `${category} materials, site protection and cleanup included.` },
      { jobId: job.id, contractorName: providerNames[1], amountCents: 235000, availableAt: "Tomorrow, 7:30 AM", message: "Workmanship warranty and final walkthrough included." },
      { jobId: job.id, contractorName: providerNames[2], amountCents: 219000, availableAt: "Thursday, 9 AM", message: "Detailed scope confirmation before work begins." },
    ]);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
