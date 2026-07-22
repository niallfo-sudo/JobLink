import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { jobEvents, jobRequests, quotes, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

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
    const externalId = `JD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const [job] = await db.insert(jobRequests).values({
      externalId, ownerEmail: user.email, category, title, description,
      size: payload.size?.trim() || "Not specified",
      timeline: payload.timeline?.trim() || "Flexible",
      budget: payload.budget?.trim() || "Need guidance",
      postalCode: payload.postalCode?.trim() || "",
      emergency: Boolean(payload.emergency),
    }).returning();

    await db.insert(jobEvents).values({ jobId: job.id, eventType: "request_created", label: "Request submitted for matching", metadata: JSON.stringify({ category }) });
    await db.insert(quotes).values([
      { jobId: job.id, contractorName: "North & Beam Drywall", amountCents: 228000, availableAt: "Tomorrow, 8–10 AM", message: "Materials, protection and cleanup included." },
      { jobId: job.id, contractorName: "Hamilton Plaster Co.", amountCents: 235000, availableAt: "Tomorrow, 7:30 AM", message: "15-year workmanship warranty." },
      { jobId: job.id, contractorName: "Level Finish Inc.", amountCents: 219000, availableAt: "Thursday, 9 AM", message: "Final walkthrough and touch-ups included." },
    ]);
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
