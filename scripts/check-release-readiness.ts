import { access, readFile } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  license?: string;
  packageManager?: string;
  engines?: {
    node?: string;
  };
};

const ROOT = process.cwd();
const PACKAGE_JSON = path.join(ROOT, "package.json");
const NPM_PUBLISHING_DOC = path.join(
  ROOT,
  "docs",
  "release",
  "npm-publishing.md",
);
const RELEASE_WORKFLOW = path.join(ROOT, ".github", "workflows", "release.yml");
const COMPATIBILITY_WORKFLOW = path.join(
  ROOT,
  ".github",
  "workflows",
  "compatibility.yml",
);
const OTEL_DRIFT_WORKFLOW = path.join(
  ROOT,
  ".github",
  "workflows",
  "otel-semconv-drift.yml",
);
const REQUIRED_FILES = [
  "README.md",
  "LICENSE",
  "SECURITY.md",
  ".bun-version",
  "scripts/migration-baseline.json",
  "scripts/performance-baseline.json",
];
const REQUIRED_PACKAGE_NAME = "genai-telemetry-redactor";
const REQUIRED_LICENSE = "Apache-2.0";
const REQUIRED_PACKAGE_MANAGER = "pnpm@11.7.0";
const REQUIRED_NODE_RANGE = ">=22.14.0";
const REQUIRED_NPM_CLI = "npm@11.18.0";
const REQUIRED_BUN_VERSION = "1.3.14";
const REQUIRED_SETUP_BUN_SHA = "0c5077e51419868618aeaa5fe8019c62421857d6";
const REQUIRED_GITHUB_SCRIPT_SHA = "ff4b64fc288a21d5291396a384c1273f032e6333";

const blockers: string[] = [];
const warnings: string[] = [];
const packageJson = JSON.parse(
  await readFile(PACKAGE_JSON, "utf8"),
) as PackageJson;

await checkRequiredFiles();
checkPackageMetadata(packageJson);
await checkPublishingPolicy();
await checkTrustedPublishingWorkflow();
await checkCompatibilityWorkflow();
await checkOtelDriftWorkflow();

if (blockers.length > 0) {
  console.error("Release readiness: blocked");
  for (const blocker of blockers) {
    console.error(`- ${blocker}`);
  }

  if (warnings.length > 0) {
    console.error("Warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  process.exitCode = 1;
} else {
  console.log("Release readiness: ready");
  for (const warning of warnings) {
    console.log(`warning: ${warning}`);
  }
}

async function checkRequiredFiles() {
  for (const file of REQUIRED_FILES) {
    await access(path.join(ROOT, file)).catch(() => {
      blockers.push(`required release file is missing: ${file}`);
    });
  }
}

function checkPackageMetadata(packageJson: PackageJson) {
  if (packageJson.name !== REQUIRED_PACKAGE_NAME) {
    blockers.push(
      `package.json name must be ${REQUIRED_PACKAGE_NAME}, got ${packageJson.name ?? "<missing>"}`,
    );
  }

  if (packageJson.private !== false) {
    blockers.push("package.json private must be false before npm publishing");
  }

  if (!packageJson.version || packageJson.version === "0.0.0") {
    blockers.push("package.json version must be set to a real release version");
  } else if (!isSemverVersion(packageJson.version)) {
    blockers.push(
      `package.json version must be a semver version, got ${packageJson.version}`,
    );
  }

  if (packageJson.type !== "module") {
    blockers.push("package.json type must stay module");
  }

  if (packageJson.license !== REQUIRED_LICENSE) {
    blockers.push(
      `package.json license must be ${REQUIRED_LICENSE}, got ${packageJson.license ?? "<missing>"}`,
    );
  }

  if (packageJson.packageManager !== REQUIRED_PACKAGE_MANAGER) {
    blockers.push(
      `package.json packageManager must be ${REQUIRED_PACKAGE_MANAGER}, got ${packageJson.packageManager ?? "<missing>"}`,
    );
  }

  if (packageJson.engines?.node !== REQUIRED_NODE_RANGE) {
    blockers.push(
      `package.json engines.node must be ${REQUIRED_NODE_RANGE}, got ${packageJson.engines?.node ?? "<missing>"}`,
    );
  }
}

async function checkPublishingPolicy() {
  const policy = await readFile(NPM_PUBLISHING_DOC, "utf8").catch(() => "");
  if (!policy) {
    blockers.push("docs/release/npm-publishing.md is missing");
    return;
  }

  if (!policy.includes("trusted publishing")) {
    blockers.push("npm publishing policy must require trusted publishing");
  }

  if (!policy.includes("long-lived npm tokens")) {
    blockers.push("npm publishing policy must reject long-lived npm tokens");
  }

  if (!policy.includes("staged publishing")) {
    blockers.push("npm publishing policy must require staged publishing");
  }
}

async function checkTrustedPublishingWorkflow() {
  const workflow = await readFile(RELEASE_WORKFLOW, "utf8").catch(() => "");
  if (!workflow) {
    blockers.push(
      ".github/workflows/release.yml must exist before npm publishing is enabled",
    );
    return;
  }

  if (!workflow.includes("id-token: write")) {
    blockers.push("release workflow must grant id-token: write for provenance");
  }

  if (!workflow.includes("contents: write")) {
    blockers.push(
      "release workflow must grant contents: write for post-publish GitHub Release creation",
    );
  }

  if (/(NPM_TOKEN|NODE_AUTH_TOKEN|_authToken)/.test(workflow)) {
    blockers.push("release workflow must not rely on long-lived npm tokens");
  }

  if (/npm\s+install\s+--global\s+npm@latest/.test(workflow)) {
    blockers.push(
      "release workflow must not install npm@latest before publish",
    );
  }

  if (!workflow.includes(`npm install --global ${REQUIRED_NPM_CLI}`)) {
    blockers.push(
      `release workflow must pin npm publish CLI to ${REQUIRED_NPM_CLI}`,
    );
  }

  if (
    !workflow.includes("GITHUB_REF_NAME") ||
    !workflow.includes("v${version}")
  ) {
    blockers.push(
      "release workflow must verify tag name matches package.json version",
    );
  }

  if (
    !workflow.includes(`oven-sh/setup-bun@${REQUIRED_SETUP_BUN_SHA}`) ||
    !workflow.includes("bun-version-file: .bun-version")
  ) {
    blockers.push("release workflow must install the pinned Bun runtime");
  }

  if (
    !workflow.includes("check-package-compatibility.ts --current") ||
    !workflow.includes('--current "${version}"')
  ) {
    blockers.push(
      "release workflow must verify the exact published package with the compatibility fixture",
    );
  }

  if (/\bnpm\s+publish\b/.test(workflow)) {
    blockers.push(
      "release workflow must stage packages instead of publishing directly",
    );
  }

  const compatibilityIndex = workflow.indexOf("pnpm run compatibility");
  const stageIndex = workflow.indexOf("npm stage publish");
  const publishedVerificationIndex = workflow.indexOf(
    "check-package-compatibility.ts --current",
  );

  if (compatibilityIndex < 0) {
    blockers.push(
      "release workflow must verify the pinned N-1 and packed current package before staging",
    );
  }

  if (stageIndex < 0) {
    blockers.push(
      "release workflow must submit releases with npm stage publish",
    );
  }

  if (
    compatibilityIndex >= 0 &&
    stageIndex >= 0 &&
    compatibilityIndex > stageIndex
  ) {
    blockers.push(
      "release workflow must run consumer compatibility before staging",
    );
  }

  if (
    stageIndex >= 0 &&
    publishedVerificationIndex >= 0 &&
    stageIndex > publishedVerificationIndex
  ) {
    blockers.push(
      "release workflow must keep exact registry verification after staging",
    );
  }

  if (!workflow.includes("steps.published.outputs.exists == 'true'")) {
    blockers.push(
      "release workflow must run exact registry verification only after the version is public",
    );
  }

  if (
    !workflow.includes(`actions/github-script@${REQUIRED_GITHUB_SCRIPT_SHA}`) ||
    !workflow.includes("github.rest.repos.getReleaseByTag") ||
    !workflow.includes("github.rest.repos.createRelease")
  ) {
    blockers.push(
      "release workflow must idempotently create the GitHub Release with the pinned github-script action",
    );
  }

  const releaseCreationIndex = workflow.indexOf(
    "github.rest.repos.createRelease",
  );
  if (
    publishedVerificationIndex >= 0 &&
    releaseCreationIndex >= 0 &&
    releaseCreationIndex < publishedVerificationIndex
  ) {
    blockers.push(
      "release workflow must create the GitHub Release only after exact published-package verification",
    );
  }
}

async function checkCompatibilityWorkflow() {
  const bunVersion = await readFile(
    path.join(ROOT, ".bun-version"),
    "utf8",
  ).catch(() => "");
  if (bunVersion.trim() !== REQUIRED_BUN_VERSION) {
    blockers.push(`.bun-version must pin Bun ${REQUIRED_BUN_VERSION}`);
  }

  const workflow = await readFile(COMPATIBILITY_WORKFLOW, "utf8").catch(
    () => "",
  );
  if (!workflow) {
    blockers.push(".github/workflows/compatibility.yml is missing");
    return;
  }
  if (
    !workflow.includes(`oven-sh/setup-bun@${REQUIRED_SETUP_BUN_SHA}`) ||
    !workflow.includes("bun-version-file: .bun-version")
  ) {
    blockers.push("compatibility workflow must install the pinned Bun runtime");
  }
  if (!workflow.includes("pnpm run compatibility")) {
    blockers.push(
      "compatibility workflow must run the configured compatibility command",
    );
  }
}

async function checkOtelDriftWorkflow() {
  const workflow = await readFile(OTEL_DRIFT_WORKFLOW, "utf8").catch(() => "");
  if (!workflow) {
    blockers.push(".github/workflows/otel-semconv-drift.yml is missing");
    return;
  }
  if (
    !workflow.includes("schedule:") ||
    !workflow.includes("workflow_dispatch:") ||
    workflow.includes("pull_request:") ||
    workflow.includes("push:")
  ) {
    blockers.push(
      "OTel semconv drift workflow must run only on schedule or explicit dispatch",
    );
  }
  if (
    !workflow.includes("contents: read") ||
    !workflow.includes("issues: write") ||
    workflow.includes("contents: write")
  ) {
    blockers.push(
      "OTel semconv drift workflow must keep read-only contents and issue-only write permissions",
    );
  }
  if (
    !workflow.includes("pnpm run otel-semconv:drift") ||
    !workflow.includes(`actions/github-script@${REQUIRED_GITHUB_SCRIPT_SHA}`) ||
    !workflow.includes("<!-- otel-genai-semconv-drift -->") ||
    !workflow.includes("github.rest.issues.listForRepo") ||
    !workflow.includes("github.rest.issues.update") ||
    !workflow.includes("github.rest.issues.create")
  ) {
    blockers.push(
      "OTel semconv drift workflow must use the validated command and deduplicated review issue contract",
    );
  }
}

function isSemverVersion(value: string) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    value,
  );
}
