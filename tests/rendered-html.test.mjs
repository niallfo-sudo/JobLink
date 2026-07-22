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
  assert.match(page, /JobLink Trust Score/);
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
  assert.match(page, /setSelectedProfile\(pro\)/);
  assert.match(page, /serviceIntakeCatalog/);
  assert.match(page, /selectedJobDetails/);
  assert.match(page, /matchedContractors/);
  for (const service of ["Drywall", "Roofing", "Painting", "Plumbing", "Electrical", "HVAC", "Junk removal", "Landscaping", "Moving", "Carpentry", "Flooring", "General contracting"]) {
    assert.match(page, new RegExp(`${service.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:?`));
  }
  assert.doesNotMatch(page, /Ask AI to negotiate|negotiating &&/);
  assert.match(profileRoute, /serviceCategories/);
  assert.match(opportunitiesRoute, /contractorProfiles/);
  assert.match(opportunitiesRoute, /acceptingWork/);
  assert.match(jobsRoute, /quoteProviderNames/);
  assert.match(jobsRoute, /providerNames\[0\]/);
});

test("supports custom request terms and persistent employee operations", async () => {
  const [page, operationsRoute, schema, migration] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/operations/route.ts"),
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
  const incompleteButtons = [...page.matchAll(/<button\b([^>]*)>/g)].filter(([, attributes]) => !/onClick=|type="submit"|disabled=/.test(attributes));
  assert.deepEqual(incompleteButtons.map((match) => match[0]), []);
  assert.match(operationsRoute, /Employee access required/);
  assert.match(operationsRoute, /operationsCaseNotes/);
  assert.match(operationsRoute, /export async function PATCH/);
  assert.match(schema, /sqliteTable\("operations_cases"/);
  assert.match(schema, /sqliteTable\("operations_case_notes"/);
  assert.match(migration, /CREATE TABLE `operations_cases`/);
});
