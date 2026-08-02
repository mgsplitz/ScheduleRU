import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  handleCatalogAdminRequest as canonicalCatalogAdmin,
  handleCatalogIngestionAdminRequest as canonicalCatalogIngestionAdmin,
  handleProgramsApi as canonicalProgramsApi,
  handleReferenceDataAdminRequest as canonicalReferenceDataAdmin,
} from "../../apps/api/src/index.js";
import {
  handleCatalogAdminRequest as compatibleCatalogAdmin,
} from "../src/catalog-admin.js";
import {
  handleCatalogIngestionAdminRequest as compatibleCatalogIngestionAdmin,
} from "../src/catalog-ingestion-admin.js";
import {
  handleReferenceDataAdminRequest as compatibleReferenceDataAdmin,
} from "../src/reference-data-admin.js";
import {
  handleProgramsApi as compatibleProgramsApi,
} from "../src/programs.js";
import canonicalWorker from "../../apps/api/src/worker.js";
import compatibleWorker from "../src/worker.js";
import {
  handleScheduleAssistantRequest as canonicalScheduleAssistant,
} from "../../apps/api/src/schedule-assistant.js";
import {
  handleScheduleAssistantRequest as compatibleScheduleAssistant,
} from "../src/schedule-assistant.js";

const canonicalWorkerSource = await readFile(
  new URL("../../apps/api/src/worker.js", import.meta.url),
  "utf8",
);
const compatibilitySource = await readFile(
  new URL("../src/worker.js", import.meta.url),
  "utf8",
);
const canonicalProgramsSource = await readFile(
  new URL("../../apps/api/src/programs.js", import.meta.url),
  "utf8",
);
const compatibleProgramsSource = await readFile(
  new URL("../src/programs.js", import.meta.url),
  "utf8",
);
const publicProgramRoutesSource = await readFile(
  new URL("../../apps/api/src/programs/public-routes.js", import.meta.url),
  "utf8",
);
const adminProgramRoutesSource = await readFile(
  new URL("../../apps/api/src/programs/admin-routes.js", import.meta.url),
  "utf8",
);
const catalogDirectoryServiceSource = await readFile(
  new URL(
    "../../apps/api/src/programs/services/catalog-directory-import-service.js",
    import.meta.url,
  ),
  "utf8",
);
const requirementDiscoveryServiceSource = await readFile(
  new URL(
    "../../apps/api/src/programs/services/requirement-discovery-service.js",
    import.meta.url,
  ),
  "utf8",
);
const compatibleScheduleAssistantSource = await readFile(
  new URL("../src/schedule-assistant.js", import.meta.url),
  "utf8",
);
const wranglerConfiguration = await readFile(
  new URL("../wrangler.toml", import.meta.url),
  "utf8",
);

test("apps/api owns the canonical development admin controllers", () => {
  assert.equal(compatibleCatalogAdmin, canonicalCatalogAdmin);
  assert.equal(compatibleCatalogIngestionAdmin, canonicalCatalogIngestionAdmin);
  assert.equal(compatibleReferenceDataAdmin, canonicalReferenceDataAdmin);
  assert.equal(compatibleProgramsApi, canonicalProgramsApi);
  assert.match(canonicalProgramsSource, /export async function handleProgramsApi/);
  assert.equal(
    compatibleProgramsSource,
    'export * from "../../apps/api/src/programs.js";\n',
  );
});

test("apps/api owns the Worker entrypoint and the legacy path is compatible", () => {
  assert.equal(compatibleWorker, canonicalWorker);
  assert.equal(compatibleScheduleAssistant, canonicalScheduleAssistant);
  assert.match(canonicalWorkerSource, /from "\.\/index\.js"/);
  assert.match(canonicalWorkerSource, /from "\.\/schedule-assistant\.js"/);
  assert.match(
    compatibilitySource,
    /export \{ default \} from "\.\.\/\.\.\/apps\/api\/src\/worker\.js"/,
  );
  assert.match(wranglerConfiguration, /main = "\.\.\/apps\/api\/src\/worker\.js"/);
  assert.equal(
    compatibleScheduleAssistantSource,
    'export * from "../../apps/api/src/schedule-assistant.js";\n',
  );
});

test("the canonical program controller has no backward dependencies on worker/src", () => {
  assert.doesNotMatch(canonicalProgramsSource, /\.\.\/\.\.\/\.\.\/worker\/src\//);
  assert.match(canonicalProgramsSource, /from "\.\/programs\/selection-policy\.js"/);
  assert.match(canonicalProgramsSource, /from "\.\/programs\/requirement-evidence\.js"/);
  assert.match(canonicalProgramsSource, /from "\.\/programs\/school-profile\.js"/);
  assert.match(
    catalogDirectoryServiceSource,
    /from "\.\.\/imports\/program-directory\.js"/,
  );
  assert.match(
    requirementDiscoveryServiceSource,
    /from "\.\.\/imports\/program-requirements\.js"/,
  );
  assert.match(canonicalProgramsSource, /from "\.\/programs\/public-routes\.js"/);
  assert.match(canonicalProgramsSource, /from "\.\/programs\/admin-routes\.js"/);
  assert.doesNotMatch(canonicalProgramsSource, /path === "\/api\/admin\/program-catalog\/import"/);
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/public-program-repository\.js"/,
  );
  assert.doesNotMatch(publicProgramRoutesSource, /env\.DB/);
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/admin-program-repository\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/scrapers\/business-school-parser\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/scrapers\/coursedog-program-parser\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/services\/catalog-directory-import-service\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/catalog-directory-repository\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/services\/requirement-import-service\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/requirement-import-repository\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/services\/requirement-candidate-service\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/requirement-candidate-repository\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/services\/requirement-discovery-service\.js"/,
  );
  assert.match(
    canonicalProgramsSource,
    /from "\.\/programs\/storage\/requirement-discovery-repository\.js"/,
  );
  assert.doesNotMatch(canonicalProgramsSource, /function parseBizTable/);
  assert.doesNotMatch(canonicalProgramsSource, /function parseProgramText/);
  assert.doesNotMatch(canonicalProgramsSource, /function importCatalogDirectorySource/);
  assert.doesNotMatch(canonicalProgramsSource, /function saveCatalogDirectoryEntries/);
  assert.doesNotMatch(canonicalProgramsSource, /function importRequirementSource/);
  assert.doesNotMatch(canonicalProgramsSource, /function saveProgramRequirementSnapshot/);
  assert.doesNotMatch(canonicalProgramsSource, /function extractRequirementCandidateBatch/);
  assert.doesNotMatch(canonicalProgramsSource, /function saveRequirementDraftCandidate/);
  assert.doesNotMatch(canonicalProgramsSource, /function registerRequirementSourcesForSchool/);
  assert.doesNotMatch(canonicalProgramsSource, /function discoverMajorRequirementSources/);
  assert.doesNotMatch(canonicalProgramsSource, /function discoverNestedRequirementDetailSources/);
  assert.doesNotMatch(adminProgramRoutesSource, /env\.DB/);
});
