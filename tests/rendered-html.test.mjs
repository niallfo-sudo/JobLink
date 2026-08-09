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

test("offers standalone shared demo workspaces to public visitors", async () => {
  const [auth, demoAuth, page] = await Promise.all([
    source("../app/chatgpt-auth.ts"),
    source("../app/api/demo-auth/route.ts"),
    source("../app/page.tsx"),
  ]);

  assert.match(auth, /DEMO_SESSION_COOKIE/);
  assert.match(auth, /demo-general-contractors@joblink\.demo/);
  assert.match(demoAuth, /ensureGeneralContractorsDemo/);
  assert.match(demoAuth, /workspace === "operations" \? "admin"/);
  assert.match(page, /External demo access uses shared sample accounts/);
  assert.match(page, /openStandaloneDemo\("homeowner"\)/);
  assert.match(page, /openStandaloneDemo\("contractor"\)/);
  assert.match(page, /openStandaloneDemo\("operations"\)/);
  assert.match(page, /Leave demo/);
});

test("lets Operations administrators switch between verified demo contractor companies", async () => {
  const [page, demoRoute, actor, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/demo-contractor/route.ts"),
    source("../app/contractor-demo.ts"),
    source("../drizzle/0020_demo_contractor_switching.sql"),
  ]);

  assert.match(page, /Demo company view/);
  assert.match(page, /switchDemoContractor/);
  assert.match(page, /createDemoContractorCompany/);
  assert.match(page, /Create new contractor company/);
  assert.match(page, /contractor accounts available/);
  assert.match(demoRoute, /Operations administrators only/);
  assert.match(demoRoute, /from\(contractorProfiles\)/);
  assert.match(demoRoute, /ensureGeneralContractorsDemo/);
  assert.match(demoRoute, /General Contractors Inc\./);
  assert.match(demoRoute, /payload\.action === "create"/);
  assert.match(demoRoute, /demo-contractor-\$\{crypto\.randomUUID/);
  assert.match(demoRoute, /function serializeProfile/);
  assert.match(demoRoute, /profile: serializeProfile\(profile\)/);
  assert.match(demoRoute, /profile\.businessName\.trim\(\) && profile\.verificationStatus !== "rejected"/);
  assert.match(demoRoute, /DEMO_CONTRACTOR_COOKIE/);
  assert.match(actor, /account\?\.role !== "admin"/);
  assert.doesNotMatch(actor, /@joblink\.demo/);
  for (const company of ["North & Beam Drywall", "Hamilton Climate Co.", "Hamilton Plumbing Co.", "Citywide Painting"]) assert.match(migration, new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("opens an existing contractor profile instead of onboarding", async () => {
  const page = await source("../app/page.tsx");

  assert.match(page, /async function openContractorArea/);
  assert.match(page, /fetch\("\/api\/contractor-profile"\)/);
  assert.match(page, /if \(response\.ok && data\.profile\)/);
  assert.match(page, /if \(profileResponse\.ok && profileData\.profile\)/);
  assert.match(page, /go\("contractor"\)/);
});

test("keeps demo contractor workspaces and job pipelines separate", async () => {
  const [page, opportunitiesRoute, quoteRoute, conversationsRoute, operationsRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/opportunities/route.ts"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/conversations/route.ts"),
    source("../app/api/operations/route.ts"),
  ]);

  assert.match(page, /window\.location\.assign\("\/\?workspace=contractor"\)/);
  assert.match(page, /workspace === "contractor"/);
  assert.match(page, /service === job\.service\.toLowerCase\(\)/);
  assert.match(opportunitiesRoute, /enabledServices\.includes\(job\.category\.toLowerCase\(\)\)/);
  assert.match(quoteRoute, /services\.includes\(job\.category\.toLowerCase\(\)\)/);
  assert.match(operationsRoute, /services\.includes\(category\)/);
  assert.match(conversationsRoute, /eq\(quotes\.status, "accepted"\)/);
  assert.doesNotMatch(conversationsRoute, /jobRequests\.ownerEmail/);
});

test("gives contractor applicants examples for every onboarding text field", async () => {
  const page = await source("../app/page.tsx");
  for (const example of ["1234567 Ontario Inc.", "Hamilton Home Improvements", "123 Main Street, Hamilton, ON L8P 1A1", "(905) 555-0123", "Example: 12", "Example: 6", "Licensed and insured residential renovation contractor", "Example: Hamilton, Ontario"]) assert.match(page, new RegExp(example.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("defers emergency requests for the initial launch", async () => {
  const [page, jobsRoute, styles] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/route.ts"),
    source("../app/globals.css"),
  ]);

  assert.match(page, /const emergencyRequestsEnabled = false/);
  assert.match(page, /emergencyRequestsEnabled && view === "emergency"/);
  assert.match(page, /emergency: false/);
  assert.match(jobsRoute, /Emergency requests are not available at launch/);
  assert.match(styles, /\.hero-quick-actions>button:first-child,.emergency-toggle,.availability-check\{display:none!important\}/);
});

test("supports custom timing, richer request details and persistent employee operations", async () => {
  const [page, operationsRoute, jobRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/operations/route.ts"),
    source("../app/api/jobs/[id]/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0010_magical_zarda.sql"),
  ]);

  assert.match(page, /customTimeline/);
  assert.match(page, /requestTimeline/);
  assert.match(page, /requestDetailLevel/);
  assert.match(page, /Basic information/);
  assert.match(page, /Detailed information/);
  assert.match(page, /No budget required/);
  assert.doesNotMatch(page, /customBudget/);
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
  const incompleteButtons = [...page.matchAll(/<button\b([^>]*)>/g)].filter(([, attributes]) => !/onClick=|type="submit"|disabled\b/.test(attributes));
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

test("provides job-specific scope checklists and detailed inputs for every service", async () => {
  const [page, catalog] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/request-catalog.ts"),
  ]);

  for (const service of ["Drywall", "Roofing", "Painting", "Plumbing", "Electrical", "HVAC", "Junk removal", "Landscaping", "Moving", "Carpentry", "Flooring", "General contracting"]) {
    assert.match(catalog, new RegExp(service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const job of ["Full electrical for addition", "Dryer or range hookup", "Bathroom renovation", "Toilet addition or replacement", "Basement renovation", "Flooring", "Walls", "Painting"]) {
    assert.match(`${page}\n${catalog}`, new RegExp(job.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.match(page, /jobWorkOptions\.map/);
  assert.match(page, /detailedInputs\.map/);
  assert.match(page, /selectedJobTasks\.length > 0/);
  assert.match(page, /Object\.values\(detailFieldValues\)/);
  assert.match(catalog, /Approximate project area/);
  assert.match(catalog, /Wall or ceiling height/);
  assert.match(catalog, /Panel size, brand and available breaker spaces/);
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
  assert.match(payoutConnect, /function serializeProfile/);
  assert.match(payoutConnect, /profile: serializeProfile\(updated\)/);
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

  assert.match(page, /Open homeowner demo/);
  assert.match(page, /Open contractor demo/);
  assert.match(page, /Open Operations demo/);
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
  assert.match(page, /both parties sign the demo service agreement/i);
  assert.match(page, /Scheduled start date and time/);
  assert.match(page, /Create final quote/);
  assert.match(page, /Detailed contract scope of work/);
  assert.match(page, /Original estimated range/);
  assert.match(page, /Finalized project start date/);
  assert.match(page, /Progress release requirement/);
  assert.match(page, /View final quote & agreement/);
  assert.match(page, /Finalized start date/);
  assert.match(page, /decideFinalQuote/);
  assert.match(quoteRoute, /request_onsite/);
  assert.match(quoteRoute, /Preliminary estimate only/);
  assert.match(quoteRoute, /nonBinding: true/);
  assert.match(quoteRoute, /schedule_onsite/);
  assert.match(quoteRoute, /submit_final/);
  assert.match(quoteRoute, /prepare_agreement/);
  assert.match(quoteRoute, /accept_final/);
  assert.match(quoteRoute, /decline_final/);
  assert.match(quoteRoute, /within the next two business days/);
  assert.match(quoteRoute, /Payment checkpoints must add up exactly to the final quote/);
  assert.match(quoteRoute, /progressRequirement/);
  assert.match(quoteRoute, /finalStartAt/);
  assert.match(quoteRoute, /Only the verified contractor can submit this final quote/);
  assert.match(contractorQuotes, /onsiteVisitAt/);
  assert.match(schema, /onsite_visit_at/);
  assert.match(schema, /work_description/);
  assert.match(schema, /deposit_cents/);
  assert.match(migration, /completion_cents/);
});

test("does not publish a request until selected media has uploaded", async () => {
  const [page, jobsRoute, schema] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/route.ts"),
    source("../db/schema.ts"),
  ]);

  assert.match(page, /form\.append\("request"/);
  assert.match(page, /requestFiles\.forEach\(\(file\) => form\.append\("files", file\)\)/);
  assert.match(page, /Uploading files/);
  assert.doesNotMatch(page, /Your request was posted, but the files did not finish uploading/);
  assert.match(jobsRoute, /multipart\/form-data/);
  assert.match(jobsRoute, /status: files\.length \? "uploading" : "matching"/);
  assert.match(jobsRoute, /set\(\{ status: "matching"/);
  assert.match(jobsRoute, /Your files could not be uploaded\. Your request was not posted/);
  assert.match(jobsRoute, /db\.delete\(jobRequests\)/);
  assert.match(schema, /job_attachments/);
});

test("supports contractor-provided finalized quote alternatives", async () => {
  const [page, quoteRoute, contractorQuotes, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-quotes/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0022_final_quote_options.sql"),
  ]);

  assert.match(page, /Optional on-site alternatives/);
  assert.match(page, /Add alternative option/);
  assert.match(page, /Alternative finalized options/);
  assert.match(page, /selectedOptionId/);
  assert.match(quoteRoute, /finalOptionsFromPayload/);
  assert.match(quoteRoute, /finalOptions/);
  assert.match(quoteRoute, /selectedFinalOptionId/);
  assert.match(contractorQuotes, /finalOptions/);
  assert.match(schema, /final_options/);
  assert.match(migration, /selected_final_option_id/);
});

test("requires a completed-job review before final payment release and calculates JobLink Score", async () => {
  const [page, reviewRoute, paymentMilestoneRoute, progressRoute, reputationRoute, paymentsRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/review/route.ts"),
    source("../app/api/payments/[id]/milestones/[milestoneId]/route.ts"),
    source("../app/api/jobs/[id]/progress/route.ts"),
    source("../app/api/reputation/route.ts"),
    source("../app/api/payments/route.ts"),
  ]);

  assert.match(page, /Required completed-job review/);
  assert.match(page, /Complete required review/);
  assert.match(page, /JobLink Score/);
  assert.match(page, /reviewComment\.trim\(\)\.length < 20/);
  assert.match(reviewRoute, /All four scores must be between 1 and 5/);
  assert.match(reviewRoute, /at least 20 characters of written feedback/);
  assert.match(paymentMilestoneRoute, /milestone\.milestoneType === "completion"/);
  assert.match(paymentMilestoneRoute, /Submit the required completed-job review before releasing the final payment/);
  assert.match(progressRoute, /homeowner review required/);
  assert.match(reputationRoute, /quality \* 0\.45 \+ completion \* 0\.25 \+ documentation \* 0\.10 \+ timeline \* 0\.20/);
  assert.match(reputationRoute, /jobLinkScore/);
  assert.match(paymentsRoute, /completionReviewSubmitted/);
});

test("requires custom initial bid ranges and scores finalized quote accuracy", async () => {
  const [page, quoteRoute, contractorQuotes, reputationRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-quotes/route.ts"),
    source("../app/api/reputation/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0023_quote_accuracy_ranges.sql"),
  ]);

  assert.match(page, /Your required initial bid range/);
  assert.match(page, /quoteMinAmount/);
  assert.match(page, /quoteMaxAmount/);
  assert.match(page, /Estimated work duration/);
  assert.match(page, /quoteCompletionTimeframe/);
  assert.match(page, /Work duration/);
  assert.match(page, /Quote Rating starts at 70/);
  assert.match(quoteRoute, /minAmount/);
  assert.match(quoteRoute, /maxAmount/);
  assert.match(quoteRoute, /completionTimeframe/);
  assert.match(quoteRoute, /Estimated completion timeframe/);
  assert.match(quoteRoute, /quoteAccuracy\(/);
  assert.match(quoteRoute, /tight_in_range/);
  assert.match(quoteRoute, /out_of_range/);
  assert.match(quoteRoute, /initial bid range with a maximum equal to or higher than the minimum/);
  assert.match(contractorQuotes, /quoteAccuracyDelta/);
  assert.match(reputationRoute, /quoteRating/);
  assert.match(schema, /initial_min_cents/);
  assert.match(migration, /quote_accuracy_status/);
});

test("waives quote-rating deductions when an out-of-range final quote is selected and explains both ratings", async () => {
  const [page, quoteRoute, reputationRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/reputation/route.ts"),
  ]);

  assert.match(page, /How is the JobLink Score calculated\?/);
  assert.match(page, /How does Quote Rating work\?/);
  assert.match(page, /How your ratings work/);
  assert.match(page, /no Quote Rating penalty/);
  assert.match(quoteRoute, /accepted_out_of_range/);
  assert.match(reputationRoute, /accepted_out_of_range/);
});

test("shows and ranks preliminary estimates using JobLink Score and Quote Rating", async () => {
  const [page, quoteRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
  ]);

  assert.match(page, /Initial estimate ratings/);
  assert.match(page, /JobLink Score and Quote Rating determine the order/);
  assert.match(page, /best overall current match/);
  assert.match(quoteRoute, /publicContractorRatings/);
  assert.match(quoteRoute, /matchScore/);
  assert.match(quoteRoute, /detailedQuotes\.sort/);
});

test("removes the comparison Insight after every quote has a final decision", async () => {
  const page = await source("../app/page.tsx");

  assert.match(page, /hasActiveQuoteComparison/);
  assert.match(page, /!\["accepted", "declined"\]\.includes\(quote\.status\)/);
  assert.match(page, /\{hasActiveQuoteComparison && <aside className="insight-card">/);
});

test("uses an initial start date and duration, with an on-site request workspace for contractors", async () => {
  const [page, quoteRoute, contractorQuotesRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-quotes/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0021_quote_estimated_schedule.sql"),
  ]);

  assert.match(page, /Estimated start date/);
  assert.doesNotMatch(page, /Estimated finish date/);
  assert.match(page, /Estimated work duration/);
  assert.match(page, /Homeowner visit requests/);
  assert.match(page, /View request & schedule/);
  assert.match(page, /On-site verification requested/);
  assert.match(page, /Verified rating/);
  assert.match(page, /Verified jobs/);
  assert.match(page, /Approved work/);
  assert.match(page, /quote-schedule-estimate/);
  assert.match(quoteRoute, /estimatedStartAt/);
  assert.doesNotMatch(quoteRoute, /payload\.estimatedFinishAt/);
  assert.match(quoteRoute, /averageRating/);
  assert.match(quoteRoute, /reviewCount/);
  assert.match(contractorQuotesRoute, /description: jobRequests\.description/);
  assert.match(contractorQuotesRoute, /timeline: jobRequests\.timeline/);
  assert.match(schema, /estimated_start_at/);
  assert.match(schema, /estimated_finish_at/);
  assert.match(migration, /estimated_start_at/);
  assert.match(migration, /estimated_finish_at/);
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
  assert.match(page, /Service agreement awaits your signature/);
  assert.match(page, /Open agreement signing/);
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

test("uses the contractor company name and gives Operations a live job board", async () => {
  const [page, operationsRoute, styles] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/operations/route.ts"),
    source("../app/globals.css"),
  ]);

  assert.match(page, /contractorProfile\?\.businessName \|\| businessName/);
  assert.match(page, /Job board and matching/);
  assert.match(page, /Eligible matches/);
  assert.match(page, /Clear all job postings/);
  assert.match(page, /Type <b>CLEAR JOBS<\/b> to confirm/);
  assert.match(operationsRoute, /matchingContractors/);
  assert.match(operationsRoute, /clear_job_postings/);
  assert.match(operationsRoute, /Administrator access is required to clear marketplace jobs/);
  assert.match(styles, /\.operations-job-board\{display:grid/);
});

test("matches contractors only to Operations-approved services", async () => {
  const [schema, migration, profileRoute, opportunitiesRoute, quoteRoute, operationsRoute, page] = await Promise.all([
    source("../db/schema.ts"),
    source("../drizzle/0019_glamorous_vargas.sql"),
    source("../app/api/contractor-profile/route.ts"),
    source("../app/api/opportunities/route.ts"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/operations/route.ts"),
    source("../app/page.tsx"),
  ]);

  assert.match(schema, /approved_services/);
  assert.match(migration, /ALTER TABLE `contractor_profiles` ADD `approved_services`/);
  assert.match(migration, /SET `approved_services` = `services` WHERE `verification_status` = 'verified'/);
  assert.match(profileRoute, /approvedServices: "\[\]"/);
  assert.match(opportunitiesRoute, /profile\.approvedServices/);
  assert.match(quoteRoute, /profile\.approvedServices/);
  assert.match(operationsRoute, /update_approved_services/);
  assert.match(page, /Edit approved services/);
  assert.match(page, /Operations-approved services/);
});

test("keeps quotes from separate contractor companies and blocks silent duplicate replacement", async () => {
  const [page, quoteRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
  ]);

  assert.match(quoteRoute, /eq\(quotes\.jobId, jobId\), eq\(quotes\.contractorEmail, user\.email\)/);
  assert.match(quoteRoute, /has already submitted a quote for this request/);
  assert.doesNotMatch(quoteRoute, /onConflictDoUpdate\(\{\s*target: \[quotes\.jobId, quotes\.contractorEmail\]/);
  assert.match(page, /Submitting as <b>\{contractorProfile\?\.businessName \|\| businessName/);
  assert.match(page, /Each contractor company can submit one initial quote/);
});

test("returns a render-safe contractor profile when a demo subscription is activated", async () => {
  const subscriptionRoute = await source("../app/api/contractor-subscription/checkout/route.ts");

  assert.match(subscriptionRoute, /function parseServices/);
  assert.match(subscriptionRoute, /services: parseServices\(updated\.services\)/);
  assert.match(subscriptionRoute, /approvedServices: parseServices\(updated\.approvedServices\)/);
});

test("coordinates homeowner visit preferences with contractor confirmations and proposals", async () => {
  const [page, quoteRoute, contractorQuotesRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/contractor-quotes/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0024_onsite_schedule_preferences.sql"),
  ]);

  assert.match(page, /Choose preferred time ranges/);
  assert.match(page, /Homeowner preferred time ranges/);
  assert.match(page, /Choose visit options/);
  assert.match(page, /Homeowner preferred time ranges/);
  assert.match(page, /Send alternate time for approval/);
  assert.match(page, /Contractor-proposed times/);
  assert.match(page, /Ask for another time suggestion/);
  assert.match(page, /onsite-range-input/);
  assert.match(page, /quote\.status === "onsite_proposed"/);
  assert.match(page, /setContractorRequestQuote\(\(current\) => current\?\.id === quote\.id \? null : current\)/);
  assert.match(page, /onPointerDown=.*Review proposed visit time/);
  assert.match(page, /confirm_proposed_onsite/);
  assert.match(quoteRoute, /preferredSlots/);
  assert.match(quoteRoute, /onsite_proposed/);
  assert.match(quoteRoute, /confirm_proposed_onsite/);
  assert.match(quoteRoute, /reject_proposed_onsite/);
  assert.match(quoteRoute, /function onsiteWindow/);
  assert.match(contractorQuotesRoute, /onsitePreferences: quotes\.onsitePreferences/);
  assert.match(schema, /onsitePreferences: text\("onsite_preferences"\)/);
  assert.match(migration, /onsite_preferences/);
  assert.match(migration, /onsite_proposals/);
});

test("uses finalized completion targets to calculate timeline reliability", async () => {
  const [page, quoteRoute, reputationRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
    source("../app/api/reputation/route.ts"),
  ]);

  assert.match(page, /Finalized completion target/);
  assert.match(page, /Timeline reliability/);
  assert.match(page, /Completion targets/);
  assert.match(quoteRoute, /finalCompletionDate/);
  assert.match(quoteRoute, /estimatedFinishAt: finalizedCompletionAt/);
  assert.match(quoteRoute, /completionTimelineScore/);
  assert.match(reputationRoute, /completionTimelineScore/);
  assert.match(reputationRoute, /timeline \* 0\.20/);
});

test("links contractor dashboard metrics to opportunities and homeowner visit requests", async () => {
  const [page, css] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/globals.css"),
  ]);

  assert.match(page, /openContractorQuoteReplies/);
  assert.match(page, /homeowner-visit-requests/);
  assert.match(page, /View quotes and homeowner visit times/);
  assert.match(page, /View opportunities/);
  assert.match(css, /overview-metric-link/);
});

test("places a homeowner approval action beside contractor-proposed visit times", async () => {
  const [page, css] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/globals.css"),
  ]);

  assert.match(page, /Review & approve visit/);
  assert.match(page, /suggested an on-site visit/);
  assert.match(page, /setOnsiteSchedulingQuote\(quote\)/);
  assert.match(css, /quote-approval-banner/);
});

test("requires before-work photos and limits booked jobs to the selected contractor", async () => {
  const [page, css, attachmentsRoute, signatureRoute, checkoutRoute, conversationsRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/globals.css"),
    source("../app/api/jobs/[id]/attachments/route.ts"),
    source("../app/api/documents/[id]/sign/route.ts"),
    source("../app/api/payments/checkout/route.ts"),
    source("../app/api/conversations/route.ts"),
    source("../db/schema.ts"),
    source("../drizzle/0026_pre_work_job_photos.sql"),
  ]);
  assert.match(page, /Before-work photos required/);
  assert.match(page, /before signing or funding/i);
  assert.match(css, /Upload required project before photos/);
  assert.match(attachmentsRoute, /form\.get\("stage"\) === "pre_work"/);
  assert.match(attachmentsRoute, /Before-work documentation must use/);
  assert.match(signatureRoute, /before-work photo before signing/i);
  assert.match(signatureRoute, /getContractorActor/);
  assert.match(signatureRoute, /You have already signed this agreement/);
  assert.match(signatureRoute, /onConflictDoNothing/);
  assert.match(checkoutRoute, /before-work photo before funding/i);
  assert.match(checkoutRoute, /Both parties must sign the service agreement before the job can be funded/);
  assert.match(conversationsRoute, /eq\(quotes\.status, "accepted"\)/);
  assert.match(schema, /stage: text\("stage"\)/);
  assert.match(migration, /ADD `stage` text NOT NULL DEFAULT 'request'/);
});

test("scopes contractor payouts to accepted quotes and released demo funds", async () => {
  const [page, paymentsRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/payments/route.ts"),
  ]);

  assert.match(paymentsRoute, /innerJoin\(quotes, eq\(paymentRecords\.quoteId, quotes\.id\)\)/);
  assert.match(paymentsRoute, /scope === "contractor"/);
  assert.match(paymentsRoute, /eq\(quotes\.contractorEmail, user\.email\)/);
  assert.match(paymentsRoute, /eq\(quotes\.status, "accepted"\)/);
  assert.match(page, /\/api\/payments\?scope=\$\{scope\}/);
  assert.match(page, /releasedPayoutCents/);
  assert.match(page, /demo_partially_released/);
  assert.match(page, /demo_released/);
  assert.match(page, /Released demo payouts/);
});

test("explains protected payment and homeowner remedies on the Trust and Safety page", async () => {
  const page = await source("../app/page.tsx");

  assert.doesNotMatch(page, /demo payment records/);
  assert.match(page, /Your money follows/);
  assert.match(page, /Payments are processed through JobLink/);
  assert.match(page, /pause unreleased funds/);
  assert.match(page, /returned to the homeowner/);
  assert.match(page, /Contractor accountability for agreed work/);
});

test("explains trustworthy reviews and both contractor ratings on the Trust and Safety page", async () => {
  const page = await source("../app/page.tsx");

  assert.match(page, /Reviews and ratings/);
  assert.match(page, /Only homeowners with a completed JobLink job can leave a review/);
  assert.match(page, /JobLink Score reflects verified work quality/);
  assert.match(page, /Quote Rating reflects how consistently/);
  assert.match(page, /Quote Rating: price-range accuracy/);
});

test("keeps JobLink Score in New Building state until the first verified review", async () => {
  const [page, reputationRoute, quoteRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/reputation/route.ts"),
    source("../app/api/jobs/[id]/quotes/route.ts"),
  ]);

  assert.match(page, /function jobLinkScoreLabel/);
  assert.match(page, /New — Building/);
  assert.match(page, /begins as New — Building until the first verified completed-job review/);
  assert.match(reputationRoute, /const jobLinkScore = verifiedReviewCount \?/);
  assert.match(quoteRoute, /const jobLinkScore = input\.reviewCount \?/);
});
