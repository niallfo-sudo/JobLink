import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../chatgpt-auth";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  const payload = (await request.json()) as { category?: string; jobType?: string; scope?: string; size?: string; details?: string[]; includes?: string[]; timeline?: string; budget?: string; notes?: string };
  if (!payload.category?.trim() || !payload.scope?.trim()) return Response.json({ error: "Service and job description are required" }, { status: 400 });
  const config = env as unknown as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
  if (!config.OPENAI_API_KEY) return Response.json({ error: "AI request drafting is temporarily unavailable" }, { status: 503 });
  const facts = JSON.stringify({ category: payload.category, jobType: payload.jobType, scope: payload.scope, size: payload.size, details: payload.details ?? [], quoteIncludes: payload.includes ?? [], timeline: payload.timeline, budget: payload.budget, notes: payload.notes });
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: config.OPENAI_MODEL || "gpt-5.6-luna", reasoning: { effort: "low" }, input: [{ role: "system", content: [{ type: "input_text", text: "Rewrite homeowner facts into a concise local-service request. Preserve every fact, never invent measurements, damage, credentials, materials, prices, dates, or access details. Return only the requested JSON." }] }, { role: "user", content: [{ type: "input_text", text: facts }] }], text: { format: { type: "json_schema", name: "job_request", strict: true, schema: { type: "object", additionalProperties: false, properties: { title: { type: "string", minLength: 5, maxLength: 120 }, description: { type: "string", minLength: 20, maxLength: 1200 } }, required: ["title", "description"] } } } }) });
  const data = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  if (!response.ok) return Response.json({ error: data.error?.message || "AI drafting failed" }, { status: 502 });
  const outputText = data.output_text || data.output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
  if (!outputText) return Response.json({ error: "AI drafting returned no text" }, { status: 502 });
  try {
    const brief = JSON.parse(outputText) as { title: string; description: string };
    if (!brief.title?.trim() || !brief.description?.trim()) throw new Error("Invalid output");
    return Response.json({ brief: { title: brief.title.trim().slice(0, 120), description: brief.description.trim().slice(0, 1200) } });
  } catch {
    return Response.json({ error: "AI drafting returned an invalid format" }, { status: 502 });
  }
}
