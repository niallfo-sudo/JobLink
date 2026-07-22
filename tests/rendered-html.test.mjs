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
  const [page, profileRoute, opportunitiesRoute] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/api/contractor-profile/route.ts"),
    source("../app/api/opportunities/route.ts"),
  ]);

  assert.match(page, /contractorServiceCatalog/);
  assert.match(page, /"General contracting"/);
  assert.match(page, /"Dog walking"/);
  assert.match(page, /setOpportunitySort\("nearest"\)/);
  assert.match(page, /setDismissedOpportunities/);
  assert.match(page, /setSelectedProfile\(pro\)/);
  assert.doesNotMatch(page, /Ask AI to negotiate|negotiating &&/);
  assert.match(profileRoute, /serviceCategories/);
  assert.match(opportunitiesRoute, /contractorProfiles/);
  assert.match(opportunitiesRoute, /acceptingWork/);
});
