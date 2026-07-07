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
const REQUIRED_FILES = ["README.md", "LICENSE", "SECURITY.md"];
const REQUIRED_PACKAGE_NAME = "genai-telemetry-redactor";
const REQUIRED_LICENSE = "Apache-2.0";
const REQUIRED_PACKAGE_MANAGER = "pnpm@11.7.0";
const REQUIRED_NODE_RANGE = ">=22.14.0";

const blockers: string[] = [];
const warnings: string[] = [];
const packageJson = JSON.parse(
  await readFile(PACKAGE_JSON, "utf8"),
) as PackageJson;

await checkRequiredFiles();
checkPackageMetadata(packageJson);
await checkPublishingPolicy();
await checkTrustedPublishingWorkflow();

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

  if (/(NPM_TOKEN|NODE_AUTH_TOKEN|_authToken)/.test(workflow)) {
    blockers.push("release workflow must not rely on long-lived npm tokens");
  }
}

function isSemverVersion(value: string) {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(
    value,
  );
}
