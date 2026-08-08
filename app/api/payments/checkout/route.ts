import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { paymentRecords } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { paymentId?: number };
  if (!Number.isInteger(payload.paymentId)) return Response.json({ error: "Payment id is required" }, { status: 400 });
  const db = getDb();
  const [payment] = await db.select().from(paymentRecords).where(and(eq(paymentRecords.id, Number(payload.paymentId)), eq(paymentRecords.ownerEmail, user.email))).limit(1);
  if (!payment) return Response.json({ error: "Payment record not found" }, { status: 404 });
  if (payment.status === "demo_paid") return Response.json({ payment, demo: true, message: "This demo payment was already simulated." });
  const [updated] = await db.update(paymentRecords).set({ status: "demo_paid", processor: "demo", updatedAt: new Date() }).where(eq(paymentRecords.id, payment.id)).returning();
  return Response.json({ payment: updated, demo: true, message: "Payment simulated. No card was charged and no funds moved." });
}
