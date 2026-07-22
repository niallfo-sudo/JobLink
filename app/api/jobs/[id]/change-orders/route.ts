import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { changeOrders, documentRecords, jobEvents, jobRequests, paymentRecords, quotes } from "../../../../../db/schema";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { notify } from "../../../../../lib/notifications";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  if (!Number.isInteger(jobId)) return Response.json({ error: "Invalid job id" }, { status: 400 });
  const rows = await getDb().select().from(changeOrders).where(and(eq(changeOrders.jobId, jobId), sql`(${changeOrders.ownerEmail} = ${user.email} OR ${changeOrders.contractorEmail} = ${user.email})`)).orderBy(asc(changeOrders.createdAt));
  return Response.json({ changeOrders: rows });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  try {
    const payload = (await request.json()) as { reason?: string; description?: string; amount?: number; scheduleImpact?: string };
    const amountCents = Math.round(Number(payload.amount) * 100);
    if (!Number.isInteger(jobId) || !payload.reason?.trim() || !payload.description?.trim() || !Number.isSafeInteger(amountCents) || amountCents < 100) return Response.json({ error: "Reason, description and a valid amount are required" }, { status: 400 });
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(eq(jobRequests.id, jobId)).limit(1);
    const [quote] = await db.select().from(quotes).where(and(eq(quotes.jobId, jobId), eq(quotes.status, "accepted"), eq(quotes.contractorEmail, user.email))).limit(1);
    if (!job || !quote) return Response.json({ error: "Only the selected contractor can create a change order" }, { status: 403 });
    const [changeOrder] = await db.insert(changeOrders).values({ externalId: `CO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, jobId, quoteId: quote.id, ownerEmail: job.ownerEmail, contractorEmail: user.email, contractorName: quote.contractorName, reason: payload.reason.trim(), description: payload.description.trim(), amountCents, scheduleImpact: payload.scheduleImpact?.trim() || "No schedule impact" }).returning();
    await db.insert(jobEvents).values({ jobId, eventType: "change_order_requested", label: `Change order ${changeOrder.externalId} awaiting approval`, metadata: JSON.stringify({ changeOrderId: changeOrder.id, amountCents }) });
    await notify(job.ownerEmail, { jobId, type: "change_order_requested", title: "Change order needs approval", body: `${quote.contractorName} requested an additional $${(amountCents / 100).toLocaleString()} for ${job.externalId}.` });
    return Response.json({ changeOrder }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const jobId = Number((await context.params).id);
  try {
    const payload = (await request.json()) as { changeOrderId?: number; decision?: "approved" | "declined"; decisionName?: string };
    if (!Number.isInteger(jobId) || !Number.isInteger(Number(payload.changeOrderId)) || !["approved", "declined"].includes(payload.decision ?? "")) return Response.json({ error: "Valid change order and decision are required" }, { status: 400 });
    const db = getDb();
    const [job] = await db.select().from(jobRequests).where(and(eq(jobRequests.id, jobId), eq(jobRequests.ownerEmail, user.email))).limit(1);
    const [order] = await db.select().from(changeOrders).where(and(eq(changeOrders.id, Number(payload.changeOrderId)), eq(changeOrders.jobId, jobId), eq(changeOrders.status, "pending"))).limit(1);
    if (!job || !order) return Response.json({ error: "Pending change order not found" }, { status: 404 });
    const decisionName = payload.decisionName?.trim() || user.displayName;
    await db.update(changeOrders).set({ status: payload.decision!, decisionName, decidedAt: new Date(), updatedAt: new Date() }).where(eq(changeOrders.id, order.id));
    if (payload.decision === "approved") {
      const feeIncrease = Math.round(order.amountCents * 0.03);
      await db.update(paymentRecords).set({ subtotalCents: sql`${paymentRecords.subtotalCents} + ${order.amountCents}`, customerFeeCents: sql`${paymentRecords.customerFeeCents} + ${feeIncrease}`, totalCents: sql`${paymentRecords.totalCents} + ${order.amountCents + feeIncrease}`, contractorPayoutCents: sql`${paymentRecords.contractorPayoutCents} + ${order.amountCents}`, updatedAt: new Date() }).where(eq(paymentRecords.jobId, jobId));
      const content = JSON.stringify({ jobNumber: job.externalId, jobTitle: job.title, scope: order.description, timeline: order.scheduleImpact, contractorName: order.contractorName, amountCents: order.amountCents, approvalName: decisionName, approvalDate: new Date().toISOString(), reason: order.reason });
      await db.insert(documentRecords).values({ externalId: order.externalId, jobId, quoteId: order.quoteId, ownerEmail: user.email, contractorEmail: order.contractorEmail, documentType: `change_order_${order.id}`, title: "Approved change order", status: "approved", content }).onConflictDoNothing();
    }
    await db.insert(jobEvents).values({ jobId, eventType: `change_order_${payload.decision}`, label: `Change order ${order.externalId} ${payload.decision}`, metadata: JSON.stringify({ changeOrderId: order.id, decisionName }) });
    await notify(order.contractorEmail, { jobId, type: `change_order_${payload.decision}`, title: `Change order ${payload.decision}`, body: `${order.externalId} was ${payload.decision} by ${decisionName}.` });
    return Response.json({ changeOrder: { ...order, status: payload.decision, decisionName } });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 }); }
}
