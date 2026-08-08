import { and, eq, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { documentRecords } from "../../../../db/schema";
import { getChatGPTUser } from "../../../chatgpt-auth";

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) return new Response("Invalid document", { status: 400 });
  try {
    const [document] = await getDb().select().from(documentRecords).where(and(eq(documentRecords.id, documentId), or(eq(documentRecords.ownerEmail, user.email), eq(documentRecords.contractorEmail, user.email)))).limit(1);
    if (!document) return new Response("Document not found", { status: 404 });
    const data = JSON.parse(document.content) as Record<string, unknown>;
    const amount = Number(data.amountCents ?? 0) / 100;
    const fee = Number(data.customerFeeCents ?? 0) / 100;
    const total = amount + fee;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(document.title)} · ${escapeHtml(document.externalId)}</title><style>body{font-family:Arial,sans-serif;color:#1d1c1a;margin:0;background:#eee9df}.page{max-width:760px;margin:30px auto;background:white;padding:54px;box-shadow:0 8px 35px #0002}.brand{color:#df5f38;font-weight:800;letter-spacing:.08em}.meta{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding-bottom:24px}h1{font-family:Georgia,serif;font-size:42px;margin:45px 0 8px}.status{display:inline-block;background:#e5eee8;color:#244c40;padding:7px 10px;text-transform:uppercase;font-size:11px;font-weight:700}.section{border-top:1px solid #ddd;margin-top:30px;padding-top:22px}.section h2{font-family:Georgia,serif;font-size:22px}.scope{line-height:1.65;color:#555}.totals{margin-left:auto;width:310px}.totals div{display:flex;justify-content:space-between;padding:9px 0}.totals .total{border-top:2px solid #222;font-size:18px;font-weight:800}.notice{background:#fff2df;padding:15px;margin-top:30px;font-size:13px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #222;padding-top:8px;color:#777;font-size:12px}@media print{body{background:white}.page{box-shadow:none;margin:0;max-width:none}}</style></head><body><main class="page"><div class="meta"><span class="brand">JOBLINK</span><span>${escapeHtml(document.externalId)}</span></div><h1>${escapeHtml(document.title)}</h1><span class="status">${escapeHtml(document.status.replaceAll("_", " "))}</span><section class="section"><h2>Job</h2><p><b>${escapeHtml(data.jobTitle)}</b><br>${escapeHtml(data.jobNumber)}</p><p class="scope">${escapeHtml(data.scope)}</p><p><b>Preferred timeline:</b> ${escapeHtml(data.timeline)}</p></section><section class="section"><h2>Professional</h2><p>${escapeHtml(data.contractorName)}</p></section><section class="section"><h2>Amounts</h2><div class="totals"><div><span>Contractor price</span><b>$${amount.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</b></div>${document.documentType === "invoice" ? `<div><span>JobLink fee</span><b>$${fee.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</b></div><div class="total"><span>Total due</span><b>$${total.toLocaleString("en-CA", { minimumFractionDigits: 2 })}</b></div>` : ""}</div></section>${document.documentType === "warranty_certificate" ? `<section class="section"><h2>Warranty record</h2><p class="scope">${escapeHtml(data.warrantyTerm)}</p></section>` : ""}${document.documentType === "service_agreement" ? `<div class="signatures"><div class="signature">Homeowner signature / date</div><div class="signature">Contractor signature / date</div></div>` : ""}<div class="notice">This document is generated from the accepted JobLink quote. Payment status must be confirmed separately in the JobLink payment record.</div></main></body></html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'self'", "X-Content-Type-Options": "nosniff", "Content-Disposition": `inline; filename="${document.externalId}.html"` } });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unexpected error", { status: 500 });
  }
}
