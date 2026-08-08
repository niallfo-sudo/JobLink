import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("ships the JobLink identity across the product", async () => {
  const [page, layout, documents, packageJson] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/layout.tsx"),
    source("../app/api/documents/[id]/route.ts"),
    source("../package.json"),
  ]);

  assert.match(page, />JobLink</);
  assert.match(page, /Verified reputation/);
  assert.match(layout, /title: "JobLink/);
  assert.match(documents, /JOBLINK/);
  assert.match(packageJson, /"name": "joblink-mvp"/);
  assert.doesNotMatch(`${page}\n${layout}\n${documents}\n${packageJson}`, /JobDrop|JOBDROP|jobdrop/);
});

test("persists authenticated support requests with JobLink references", async () => {
  const [route, schema, page] = await Promise.all([
    source("../app/api/support/route.ts"),
    source("../db/schema.ts"),
    source("../app/page.tsx"),
  ]);

  assert.match(route, /getChatGPTUser/);
  assert.match(route, /insert\(supportRequests\)/);
  assert.match(route, /insert\(operationsCases\)/);
  assert.match(route, /Trust and safety report/);
  assert.match(route, /Payment or invoice support request/);
  assert.match(route, /`JL-S\$\{crypto\.randomUUID/);
  assert.match(schema, /sqliteTable\("support_requests"/);
  assert.match(schema, /support_requests_requester_created_idx/);
  assert.match(page, /fetch\("\/api\/support"/);
  assert.match(page, /Request \{supportReference\} received/);
});

test("stores private job media in R2 with D1 ownership metadata", async () => {
  const [uploadRoute, downloadRoute, schema, hosting, page] = await Promise.all([
    source("../app/api/jobs/[id]/attachments/route.ts"),
    source("../app/api/jobs/[id]/attachments/[attachmentId]/route.ts"),
    source("../db/schema.ts"),
    source("../.openai/hosting.json"),
    source("../app/page.tsx"),
  ]);

  assert.match(uploadRoute, /getChatGPTUser/);
  assert.match(uploadRoute, /maxFileBytes = 25 \* 1024 \* 1024/);
  assert.match(uploadRoute, /UPLOADS/);
  assert.match(downloadRoute, /Content-Disposition/);
  assert.match(downloadRoute, /X-Content-Type-Options/);
  assert.match(schema, /sqliteTable\("job_attachments"/);
  assert.match(hosting, /"r2": "UPLOADS"/);
  assert.match(page, /chooseRequestFiles/);
  assert.match(page, /job-media-tray/);
});

test("wires existing controls and contractor service matching", async () => {
  const [page, profileRoute, opportunitiesRoute, jobsRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/contractor-profile/route.ts"),
    source("../app/api/opportunities/route.ts"),
    source("../app/api/jobs/route.ts"),
  ]);

  assert.match(page, /contractorServiceCatalog/);
  assert.match(page, /"General contracting"/);
  for (const removedService of ["Snow removal", "Cleaning", "Appliance repair", "Locksmith", "Pest control", "Auto detailing", "Dog walking"]) {
    assert.doesNotMatch(page, new RegExp(`"${removedService}"`));
  }
  assert.match(page, /setOpportunitySort\("nearest"\)/);
  assert.match(page, /setDismissedOpportunities/);
  assert.match(page, /serviceIntakeCatalog/);
  assert.match(page, /selectedJobDetails/);
  assert.doesNotMatch(page, /matchedContractors|North & Beam|Hamilton Plaster Co\./);
  for (const service of ["Drywall", "Roofing", "Painting", "Plumbing", "Electrical", "HVAC", "Junk removal", "Landscaping", "Moving", "Carpentry", "Flooring", "General contracting"]) {
    assert.match(page, new RegExp(`${service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:?`));
  }
  assert.doesNotMatch(page, /Ask AI to negotiate|negotiating &&/);
  assert.match(profileRoute, /serviceCategories/);
  assert.match(profileRoute, /operationsCases/);
  assert.match(profileRoute, /Contractor application review/);
  assert.match(profileRoute, /Verification approval is required before accepting work/);
  assert.match(profileRoute, /acceptingWork: false/);
  assert.match(opportunitiesRoute, /contractorProfiles/);
  assert.match(opportunitiesRoute, /acceptingWork/);
  assert.match(opportunitiesRoute, /verificationStatus !== "verified"/);
  assert.doesNotMatch(jobsRoute, /quoteProviderNames|providerNames\[0\]|insert\(quotes\)/);
});

test("supports custom request terms and persistent employee operations", async () => {
  const [page, operationsRoute, jobRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/operations/route.ts"),
    source("../app/api/jobs/[id]/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0010_magical_zarda.sql"),
  ]);

  assert.match(page, /customTimeline/);
  assert.match(page, /customBudget/);
  assert.match(page, /requestTimeline/);
  assert.match(page, /requestBudget/);
  assert.match(page, /filteredOperationsCases/);
  assert.match(page, /updateOperationsCase/);
  assert.match(page, /operations-drawer/);
  assert.match(page, /submitEmergencyRequest/);
  assert.match(page, /updateEmergencyRequestStatus/);
  assert.match(page, /filteredHelpFaqs/);
  assert.match(page, /filteredConversations/);
  assert.match(page, /visibleContractorJobs/);
  assert.match(page, /openLatestRequest/);
  assert.match(page, /trackingJob/);
  assert.match(page, /acceptedSavedQuote/);
  assert.match(page, /await loadSavedQuotes\(createdJob\)/);
  assert.match(page, /decideFinalQuote/);
  assert.match(page, /persistedJobs\.filter\(\(job\) => job\.status === "completed"\)/);
  assert.doesNotMatch(page, /Off-platform job import is ready/);
  const incompleteButtons = [...page.matchAll(/<button\b([^>]*)>/g)].filter(([, attributes]) => !/onClick=|type="submit"|disabled=/.test(attributes));
  assert.deepEqual(incompleteButtons.map((match) => match[0]), []);
  assert.match(operationsRoute, /Employee access required/);
  assert.doesNotMatch(operationsRoute, /seedCases|ensureSeedCases/);
  assert.match(operationsRoute, /Operations workspace unavailable/);
  assert.match(operationsRoute, /syncPendingVerificationCases/);
  assert.match(operationsRoute, /contractorProfiles\.verificationStatus/);
  assert.match(operationsRoute, /onConflictDoUpdate/);
  assert.match(operationsRoute, /allowedVerificationDecisions/);
  assert.match(operationsRoute, /verificationStatus: payload\.decision/);
  assert.match(page, /operationsStatus !== "loading" && operationsStatus !== "error"/);
  assert.match(page, /Approve contractor/);
  assert.match(page, /contractorVerificationCopy/);
  assert.match(page, /No contractor applications are waiting for verification/);
  assert.match(operationsRoute, /Administrator access required/);
  assert.match(operationsRoute, /export async function POST/);
  assert.match(operationsRoute, /payload\.action === "case"/);
  assert.match(operationsRoute, /Case type, title, subject and summary are required/);
  assert.match(operationsRoute, /export async function DELETE/);
  assert.match(operationsRoute, /You cannot remove your own administrator access/);
  assert.match(page, /Operations team/);
  assert.match(page, /addOperationsStaff/);
  assert.match(page, /removeOperationsStaff/);
  assert.match(page, /createOperationsCase/);
  assert.match(page, /Create a new case/);
  assert.match(operationsRoute, /operationsCaseNotes/);
  assert.match(operationsRoute, /export async function PATCH/);
  assert.match(jobRoute, /request_cancelled/);
  assert.match(schema, /sqliteTable\("operations_cases"/);
  assert.match(schema, /sqliteTable\("operations_case_notes"/);
  assert.match(migration, /CREATE TABLE `operations_cases`/);
});

test("uses production-backed AI and verification with explicit demo money workflows", async () => {
  const [page, schema, quoteRoute, verificationRoute, aiRoute, paymentCheckout, subscriptionCheckout, payoutConnect, webhook, operationsRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../db/schema.ts"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-verification/route.ts"),
    source("../app/api/ai/request-brief/route.ts"),
    source("../app/api/payments/checkout/route.ts"),
    source("../app/api/contractor-subscription/checkout/route.ts"),
    source("../app/api/contractor-payments/connect/route.ts"),
    source("../app/api/payments/webhook/route.ts"),
    source("../app/api/operations/route.ts"),
  ]);

  assert.match(page, /startVoiceCapture/);
  assert.match(page, /generateAiBrief/);
  assert.match(page, /uploadVerificationDocument/);
  assert.match(page, /startPaymentCheckout/);
  assert.match(page, /startSubscriptionCheckout/);
  assert.match(page, /openPayoutSetup/);
  assert.match(page, /setQuoteNote\("Quote includes labour, materials and cleanup/);
  assert.match(page, /data\.error \|\| "Unable to submit quote"/);
  assert.doesNotMatch(page, /quoteAvailability\.trim\(\)\.length < 3 \|\| quoteNote\.trim\(\)\.length < 10/);
  assert.doesNotMatch(page, /Start voice demo|Harbour Home Response|Arriving in 14 minutes|Niall L\.|North & Beam/);
  assert.match(schema, /contractor_verification_documents/);
  assert.match(schema, /stripe_connect_account_id/);
  assert.match(verificationRoute, /UPLOADS/);
  assert.match(operationsRoute, /contractorVerificationDocuments/);
  assert.match(operationsRoute, /verifiedContractors/);
  assert.match(operationsRoute, /status: "open"/);
  assert.match(operationsRoute, /shouldReopen \? ""/);
  assert.match(quoteRoute, /verificationStatus === "verified"/);
  assert.match(quoteRoute, /subscriptionStatus/);
  assert.match(aiRoute, /api\.openai\.com\/v1\/responses/);
  assert.match(aiRoute, /json_schema/);
  assert.match(paymentCheckout, /demo_held/);
  assert.doesNotMatch(paymentCheckout, /api\.stripe\.com/);
  assert.match(subscriptionCheckout, /demo_active/);
  assert.doesNotMatch(subscriptionCheckout, /api\.stripe\.com/);
  assert.match(payoutConnect, /demo payout destination enabled/i);
  assert.doesNotMatch(payoutConnect, /api\.stripe\.com/);
  assert.match(webhook, /disabled.*demo mode/i);
  assert.match(page, /Payment demo for accepted quotes/);
  assert.match(page, /Verified contractors/);
});

test("provides secure homeowner, contractor and operations account entry", async () => {
  const [page, accountRoute, operationsRoute, auth] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/account/route.ts"),
    source("../app/api/operations/route.ts"),
    source("../app/chatgpt-auth.ts"),
  ]);

  assert.match(page, /Sign up as a homeowner/);
  assert.match(page, /Sign up as a contractor/);
  assert.match(page, /Log in to Operations/);
  assert.match(page, /signin-with-chatgpt/);
  assert.match(page, /signout-with-chatgpt/);
  assert.doesNotMatch(page, /type="password"/);
  assert.match(accountRoute, /selfServiceRoles/);
  assert.match(accountRoute, /activeWorkspace/);
  assert.match(accountRoute, /operationsRole/);
  assert.match(page, /Operations.*access retained/);
  assert.doesNotMatch(accountRoute, /selfServiceRoles.*admin/);
  assert.match(operationsRoute, /Employee access required/);
  assert.match(auth, /oai-authenticated-user-email/);
});

test("protects request deletion and records a scheduled job start", async () => {
  const [page, jobRoute, progressRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/route.ts"),
    source("../app/api/jobs/[id]/progress/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0014_scheduled_start.sql"),
  ]);

  assert.match(page, /deleteSavedRequest/);
  assert.match(page, /Delete request/);
  assert.match(page, /scheduleJobStart/);
  assert.match(page, /Scheduled start date and time/);
  assert.doesNotMatch(page, /Crew leaving/);
  assert.match(jobRoute, /export async function DELETE/);
  assert.match(jobRoute, /A request can only be deleted before a contractor is accepted/);
  assert.match(jobRoute, /jobRequests\.ownerEmail, user\.email/);
  assert.match(jobRoute, /scheduledStartAt/);
  assert.match(jobRoute, /Only the selected contractor can schedule this job/);
  assert.match(jobRoute, /start_scheduled/);
  assert.doesNotMatch(progressRoute, /crew_dispatched/);
  assert.match(schema, /scheduled_start_at/);
  assert.match(migration, /scheduled_start_at/);
});

test("runs on-site verification and final quotes before booking", async () => {
  const [page, quoteRoute, contractorQuotes, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-quotes/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0015_onsite_final_quotes.sql"),
  ]);

  assert.match(page, /Request on-site quote — no commitment/);
  assert.match(page, /preliminary estimate only/i);
  assert.match(page, /not an acceptance, booking or commitment/i);
  assert.match(page, /Only accepting the finalized quote selects the contractor/);
  assert.match(page, /Scheduled start date and time/);
  assert.match(page, /Create final quote/);
  assert.match(page, /Confirmed work description/);
  assert.match(page, /Accept final quote/);
  assert.match(page, /decideFinalQuote/);
  assert.match(quoteRoute, /request_onsite/);
  assert.match(quoteRoute, /Preliminary estimate only/);
  assert.match(quoteRoute, /nonBinding: true/);
  assert.match(quoteRoute, /schedule_onsite/);
  assert.match(quoteRoute, /submit_final/);
  assert.match(quoteRoute, /accept_final/);
  assert.match(quoteRoute, /decline_final/);
  assert.match(quoteRoute, /within the next two business days/);
  assert.match(quoteRoute, /Payment checkpoints must add up exactly to the final quote/);
  assert.match(quoteRoute, /Only the verified contractor can submit this final quote/);
  assert.match(contractorQuotes, /onsiteVisitAt/);
  assert.match(schema, /onsite_visit_at/);
  assert.match(schema, /work_description/);
  assert.match(schema, /deposit_cents/);
  assert.match(migration, /completion_cents/);
});

test("holds the full job in the demo ledger and releases milestones after proof approval", async () => {
  const [page, paymentRoute, checkoutRoute, milestoneRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/payments/route.ts"),
    source("../app/api/payments/checkout/route.ts"),
    source("../app/api/payments/[id]/milestones/[milestoneId]/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0016_payment_milestones.sql"),
  ]);

  assert.match(page, /Fund full job total/);
  assert.match(page, /Submit proof for approval/);
  assert.match(page, /Approve and release/);
  assert.match(page, /Protected release plan/);
  assert.match(paymentRoute, /paymentMilestones/);
  assert.match(checkoutRoute, /demo_held/);
  assert.match(checkoutRoute, /Full job amount is now held/);
  assert.match(milestoneRoute, /submit_proof/);
  assert.match(milestoneRoute, /approve_release/);
  assert.match(milestoneRoute, /Only the homeowner can approve a payment release/);
  assert.match(milestoneRoute, /Proof must be submitted before the homeowner can approve a release/);
  assert.match(schema, /paymentMilestones/);
  assert.match(schema, /released_cents/);
  assert.match(migration, /payment_milestones/);
  assert.match(migration, /released_cents/);
});

test("requires a recorded two-party service agreement before work can start", async () => {
  const [page, documentsRoute, signatureRoute, documentViewRoute, jobRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/documents/route.ts"),
    source("../app/api/documents/[id]/sign/route.ts"),
    source("../app/api/documents/[id]/route.ts"),
    source("../app/api/jobs/[id]/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0017_agreement_signatures.sql"),
  ]);

  assert.match(page, /Sign service agreement/);
  assert.match(page, /intend to sign it electronically/);
  assert.match(page, /Both parties have signed/);
  assert.match(documentsRoute, /agreementSignatures/);
  assert.match(signatureRoute, /account_attestation/);
  assert.match(signatureRoute, /You are not a party to this agreement/);
  assert.match(signatureRoute, /Service agreement fully signed/);
  assert.match(documentViewRoute, /Homeowner signed/);
  assert.match(jobRoute, /Both parties must sign the service agreement before the job can start/);
  assert.match(jobRoute, /The homeowner must fund the full job before the job can start/);
  assert.match(schema, /agreementSignatures/);
  assert.match(migration, /agreement_signatures/);
});

test("gives Operations a persistent payment-proof hold and clearance workflow", async () => {
  const [page, operationsRoute, paymentRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/operations/route.ts"),
    source("../app/api/payments/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0018_payment_operations_review.sql"),
  ]);

  assert.match(page, /Proof review queue/);
  assert.match(page, /Place on hold/);
  assert.match(page, /Clear for homeowner/);
  assert.match(page, /Operations review/);
  assert.match(operationsRoute, /payment_milestone_review/);
  assert.match(operationsRoute, /operations_hold/);
  assert.match(operationsRoute, /Only submitted proof can be placed on hold/);
  assert.match(operationsRoute, /Only a held release can be cleared/);
  assert.match(operationsRoute, /payment_release_held/);
  assert.match(paymentRoute, /paymentMilestones/);
  assert.match(schema, /operationsReviewedBy/);
  assert.match(migration, /payment_milestones_operations_review_idx/);
});

test("keeps Insight availability labels separate from long values", async () => {
  const [page, styles] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/globals.css"),
  ]);

  assert.match(page, /<span>Availability<\/span><b>/);
  assert.match(styles, /\.insight-card>div\{display:grid;grid-template-columns:/);
  assert.match(styles, /\.insight-card>div>b\{min-width:0;text-align:right;/);
});
