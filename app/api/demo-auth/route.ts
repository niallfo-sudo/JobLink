import { cookies } from "next/headers";
import { getDb } from "../../../db";
import { users } from "../../../db/schema";
import { DEMO_SESSION_COOKIE, demoUserForWorkspace, type DemoWorkspace } from "../../chatgpt-auth";
import { ensureGeneralContractorsDemo } from "../demo-contractor/route";

const workspaces = new Set<DemoWorkspace>(["homeowner", "contractor", "operations"]);

function sessionCookie(workspace: DemoWorkspace, maxAge = 60 * 60 * 8) {
  return `${DEMO_SESSION_COOKIE}=${workspace}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`;
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { workspace?: string };
    if (!payload.workspace || !workspaces.has(payload.workspace as DemoWorkspace)) return Response.json({ error: "Choose a demo workspace" }, { status: 400 });
    const workspace = payload.workspace as DemoWorkspace;
    const user = demoUserForWorkspace(workspace);
    const role = workspace === "operations" ? "admin" : workspace;
    const activeWorkspace = workspace === "operations" ? "admin" : workspace;
    await getDb().insert(users).values({ email: user.email, displayName: user.displayName, role, activeWorkspace }).onConflictDoUpdate({ target: users.email, set: { displayName: user.displayName, role, activeWorkspace } });
    if (workspace === "contractor") await ensureGeneralContractorsDemo();
    return Response.json({ user: { email: user.email, displayName: user.displayName, role: activeWorkspace, operationsRole: workspace === "operations" ? "admin" : null } }, { headers: { "Set-Cookie": sessionCookie(workspace) } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Demo access could not be started" }, { status: 500 });
  }
}

export async function DELETE() {
  (await cookies()).delete(DEMO_SESSION_COOKIE);
  return Response.json({ cleared: true }, { headers: { "Set-Cookie": `${DEMO_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0` } });
}
