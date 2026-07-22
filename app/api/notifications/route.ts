import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { notifications } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const rows = await getDb().select().from(notifications).where(eq(notifications.recipientEmail, user.email)).orderBy(desc(notifications.createdAt)).limit(50);
  return Response.json({ notifications: rows, unread: rows.filter((row) => !row.readAt).length });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { id?: number; all?: boolean };
  const db = getDb();
  if (payload.all) await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.recipientEmail, user.email));
  else if (Number.isInteger(Number(payload.id))) await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, Number(payload.id)));
  else return Response.json({ error: "Notification id or all is required" }, { status: 400 });
  return Response.json({ ok: true });
}
