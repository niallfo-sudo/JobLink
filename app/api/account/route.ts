import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const selfServiceRoles = new Set(["homeowner", "contractor"]);

export async function GET() {
  try {
    const identity = await getChatGPTUser();
    if (!identity) return Response.json({ user: null });

    const db = getDb();
    const [record] = await db.select({ role: users.role }).from(users).where(eq(users.email, identity.email)).limit(1);
    return Response.json({
      user: {
        email: identity.email,
        displayName: identity.displayName,
        role: record?.role ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account could not be loaded";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const identity = await getChatGPTUser();
    if (!identity) return Response.json({ error: "Sign in required" }, { status: 401 });

    const payload = (await request.json()) as { role?: string };
    if (!payload.role || !selfServiceRoles.has(payload.role)) {
      return Response.json({ error: "Choose a homeowner or contractor account" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.email, identity.email)).limit(1);
    if (existing && ["employee", "admin"].includes(existing.role)) {
      return Response.json({ error: "Employee roles are managed in Operations" }, { status: 403 });
    }

    await db.insert(users).values({
      email: identity.email,
      displayName: identity.displayName,
      role: payload.role,
    }).onConflictDoUpdate({
      target: users.email,
      set: { displayName: identity.displayName, role: payload.role },
    });

    return Response.json({
      user: { email: identity.email, displayName: identity.displayName, role: payload.role },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account could not be updated";
    return Response.json({ error: message }, { status: 500 });
  }
}
