import { getDb } from "../db";
import { notifications } from "../db/schema";

export async function notify(recipientEmail: string | null | undefined, notification: { jobId?: number; type: string; title: string; body: string }) {
  if (!recipientEmail) return;
  await getDb().insert(notifications).values({ recipientEmail, jobId: notification.jobId, notificationType: notification.type, title: notification.title, body: notification.body });
}
