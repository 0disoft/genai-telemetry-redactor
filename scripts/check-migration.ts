import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createBuiltInDetectors } from "../packages/core/src/built-in-detectors.js";
import { defaultReplacementToken } from "../packages/core/src/redact-text.js";
import { REDACTION_WARNING_CODES } from "../packages/core/src/warning-codes.js";
import { OTEL_GENAI_SEMCONV_COMMIT } from "../packages/otel/src/semconv.js";

const ROOT = process.cwd();
const BASELINE_SCHEMA = "genai-telemetry-redactor/migration-baseline/v1";
const PACKAGE_NAME = "genai-telemetry-redactor";
const PUBLIC_API_MARKERS = {
  start: "<!-- public-api-inventory:start -->",
  end: "<!-- public-api-inventory:end -->",
};
const SDK_API_MARKERS = {
  start: "<!-- sdk-api-inventory:start -->",
  end: "<!-- sdk-api-inventory:end -->",
};

type PackageJson = {
  name?: string;
  version?: string;
  engines?: { node?: string };
  exports?: Record<string, { types?: string; default?: string }>;
};

type CompatibilityBaseline = {
  version?: string;
};

export type MigrationContract = {
  nodeEngine: string;
  packageExports: Record<string, { types: string; default: string }>;
  publicApiInventorySha256: string;
  sdkApiInventorySha256: string;
  defaultDetectors: Array<{ id: string; reasons: string[] }>;
  replacementTokens: Record<string, string>;
  warningCodes: string[];
  otelSemconvCommit: string;
};

type MigrationBaseline = {
  schemaVersion?: string;
  package?: string;
  version?: string;
  previousVersion?: string;
  contract?: MigrationContract;
};

export function compareMigrationContracts(
  expected: MigrationContract,
  actual: MigrationContract,
): string[] {
  const violations: string[] = [];
  if (stableJson(expected) !== stableJson(actual)) {
    violations.push(
      "migration contract changed; review semver, migration notes, compatibility baseline, and scripts/migration-baseline.json",
    );
  }
  return violations;
}

export function migrationGuideSection(
  sourceText: string,
  version: string,
): string | undefined {
  const heading = `## ${version}`;
  const start = sourceText.indexOf(heading);
  if (start < 0) {
    return undefined;
  }
  const nextHeading = sourceText.indexOf("\n## ", start + heading.length);
  return sourceText
    .slice(start, nextHeading < 0 ? undefined : nextHeading)
    .trim();
}

export async function collectMigrationContract(): Promise<MigrationContract> {
  const packageJson = await readJson<PackageJson>("package.json");
  const libraryApi = await readFile(
    path.join(ROOT, "docs", "library", "public-api.md"),
    "utf8",
  );
  const sdkApi = await readFile(
    path.join(ROOT, "docs", "sdk", "public-api.md"),
    "utf8",
  );
  const defaultDetectors = createBuiltInDetectors().map((detector) => ({
    id: detector.id,
    reasons: [...detector.reasons],
  }));
  const replacementTokens = Object.fromEntries(
    defaultDetectors.flatMap((detector) =>
      detector.reasons.map((reason) => [
        reason,
        defaultReplacementToken(reason),
      ]),
    ),
  );

  return {
    nodeEngine: requiredString(
      packageJson.engines?.node,
      "package engines.node",
    ),
    packageExports: normalizePackageExports(packageJson.exports),
    publicApiInventorySha256: inventoryHash(
      libraryApi,
      PUBLIC_API_MARKERS,
      "library public API",
    ),
    sdkApiInventorySha256: inventoryHash(
      sdkApi,
      SDK_API_MARKERS,
      "SDK public API",
    ),
    defaultDetectors,
    replacementTokens,
    warningCodes: [...REDACTION_WARNING_CODES],
    otelSemconvCommit: OTEL_GENAI_SEMCONV_COMMIT,
  };
}

async function runMigrationCheck(): Promise<void> {
  const packageJson = await readJson<PackageJson>("package.json");
  const actualContract = await collectMigrationContract();

  if (process.argv.includes("--print-contract")) {
    process.stdout.write(`${JSON.stringify(actualContract, null, 2)}\n`);
    return;
  }

  const baseline = await readJson<MigrationBaseline>(
    path.join("scripts", "migration-baseline.json"),
  );
  const compatibility = await readJson<CompatibilityBaseline>(
    path.join("scripts", "compatibility-baseline.json"),
  );
  const migrationGuide = await readFile(
    path.join(ROOT, "docs", "library", "migration-guide.md"),
    "utf8",
  );
  const violations = validateBaseline(
    packageJson,
    baseline,
    compatibility,
    migrationGuide,
  );

  if (baseline.contract) {
    violations.push(
      ...compareMigrationContracts(baseline.contract, actualContract),
    );
  }

  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`Migration check: ${violation}\n`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Migration check passed: ${PACKAGE_NAME}@${baseline.version} against ${baseline.previousVersion}\n`,
  );
}

function validateBaseline(
  packageJson: PackageJson,
  baseline: MigrationBaseline,
  compatibility: CompatibilityBaseline,
  migrationGuide: string,
): string[] {
  const violations: string[] = [];
  if (baseline.schemaVersion !== BASELINE_SCHEMA) {
    violations.push(`baseline schema must be ${BASELINE_SCHEMA}`);
  }
  if (baseline.package !== PACKAGE_NAME || packageJson.name !== PACKAGE_NAME) {
    violations.push(`package name must stay ${PACKAGE_NAME}`);
  }
  if (!baseline.version || baseline.version !== packageJson.version) {
    violations.push(
      "migration baseline version must match package.json version",
    );
  }
  if (
    !baseline.previousVersion ||
    baseline.previousVersion !== compatibility.version
  ) {
    violations.push(
      "migration baseline previousVersion must match the compatibility baseline",
    );
  }
  if (
    baseline.version &&
    baseline.previousVersion &&
    compareSemver(baseline.version, baseline.previousVersion) <= 0
  ) {
    violations.push(
      "migration baseline version must be newer than previousVersion",
    );
  }
  if (!baseline.contract) {
    violations.push("migration baseline contract is missing");
  }
  if (baseline.version) {
    const section = migrationGuideSection(migrationGuide, baseline.version);
    if (!section || section.length < 100) {
      violations.push(
        `docs/library/migration-guide.md must contain a substantive ## ${baseline.version} section`,
      );
    }
  }
  return violations;
}

function normalizePackageExports(
  exportsValue: PackageJson["exports"],
): MigrationContract["packageExports"] {
  if (!exportsValue || typeof exportsValue !== "object") {
    throw new Error("package exports are missing");
  }

  return Object.fromEntries(
    Object.entries(exportsValue)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([exportName, targets]) => [
        exportName,
        {
          types: requiredString(targets.types, `${exportName} types target`),
          default: requiredString(
            targets.default,
            `${exportName} default target`,
          ),
        },
      ]),
  );
}

function inventoryHash(
  sourceText: string,
  markers: { start: string; end: string },
  label: string,
): string {
  const start = sourceText.indexOf(markers.start);
  const end = sourceText.indexOf(markers.end);
  if (start < 0 || end <= start) {
    throw new Error(`${label} inventory markers are missing`);
  }
  const normalized = sourceText
    .slice(start + markers.start.length, end)
    .trim()
    .replaceAll("\r\n", "\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function compareSemver(left: string, right: string): number {
  const [leftMajor, leftMinor, leftPatch] = parseSemver(left);
  const [rightMajor, rightMinor, rightPatch] = parseSemver(right);
  const pairs = [
    [leftMajor, rightMajor],
    [leftMinor, rightMinor],
    [leftPatch, rightPatch],
  ] as const;
  for (const [leftPart, rightPart] of pairs) {
    const difference = leftPart - rightPart;
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function parseSemver(value: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value);
  if (!match) {
    throw new Error(`expected an exact stable semver, got ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} is missing`);
  }
  return value;
}

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(ROOT, relativePath), "utf8")) as T;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runMigrationCheck().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    process.stderr.write(`Migration check failed: ${message}\n`);
    process.exitCode = 1;
  });
}
