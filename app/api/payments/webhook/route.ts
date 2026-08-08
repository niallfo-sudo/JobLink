export async function POST() {
  return Response.json({ error: "Payment webhooks are disabled while JobLink payments are in demo mode." }, { status: 410 });
}
