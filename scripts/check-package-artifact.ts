import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";

type PackageJson = {
  exports?: Record<string, { types?: string; default?: string }>;
  files?: string[];
};

type PackFile = {
  path: string;
};

type PackResult = {
  files?: PackFile[];
};

const execFileAsync = promisify(execFile);
const PACKAGE_JSON = "package.json";
const FORBIDDEN_ARTIFACT_PATHS = [
  ".agents/",
  ".github/",
  ".ssealed/",
  "diagrams/",
  "scripts/",
  "docs/non-goals/",
];
const FORBIDDEN_ARTIFACT_SEGMENTS = ["/test/"];
const REQUIRED_FILES = [
  "package.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "examples/custom-detector.ts",
  "examples/openai-compatible-basic.ts",
  "examples/streaming-metadata-only.ts",
  "dist/src/index.js",
  "dist/src/index.d.ts",
  "packages/core/package.json",
  "dist/packages/core/src/index.js",
  "dist/packages/core/src/index.d.ts",
  "packages/openai-compatible/package.json",
  "dist/packages/openai-compatible/src/index.js",
  "dist/packages/openai-compatible/src/index.d.ts",
  "packages/otel/package.json",
  "dist/packages/otel/src/index.js",
  "dist/packages/otel/src/index.d.ts",
  "packages/sdk/package.json",
  "dist/packages/sdk/src/index.js",
  "dist/packages/sdk/src/index.d.ts",
];
const REQUIRED_FILE_PATTERNS = [
  "dist/",
  "examples/",
  "packages/*/package.json",
  "README.md",
  "LICENSE",
  "SECURITY.md",
  "docs/adapters/",
  "docs/backend/06-logging-and-observability.md",
  "docs/library/",
  "docs/otel/",
  "docs/product/02-spec.md",
  "docs/sdk/",
  "docs/security/",
];
const NPM_EXECUTABLE = process.platform === "win32" ? "npm.cmd" : "npm";

const violations: string[] = [];
const packageJson = JSON.parse(
  await readFile(PACKAGE_JSON, "utf8"),
) as PackageJson;

checkFilesAllowList(packageJson);

const packResult = await dryRunPack();
const packedFiles = new Set(
  (packResult.files ?? []).map((file) => normalizePath(file.path)),
);

checkRequiredFiles(packedFiles);
checkExportTargets(packageJson, packedFiles);
checkForbiddenFiles(packedFiles);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
}

function checkFilesAllowList(packageJson: PackageJson) {
  const files = packageJson.files ?? [];
  const actual = [...files].sort((left, right) => left.localeCompare(right));
  const expected = [...REQUIRED_FILE_PATTERNS].sort((left, right) =>
    left.localeCompare(right),
  );

  if (actual.join("\n") !== expected.join("\n")) {
    violations.push(
      `package.json files allowlist drift: expected ${expected.join(", ")}, got ${actual.join(", ")}`,
    );
  }
}

async function dryRunPack(): Promise<PackResult> {
  const command =
    process.platform === "win32"
      ? {
          file: "cmd.exe",
          args: [
            "/d",
            "/s",
            "/c",
            "npm pack --dry-run --json --ignore-scripts",
          ],
        }
      : {
          file: NPM_EXECUTABLE,
          args: ["pack", "--dry-run", "--json", "--ignore-scripts"],
        };
  const { stdout } = await execFileAsync(command.file, command.args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  });
  const parsed = JSON.parse(stdout) as PackResult[];
  const [result] = parsed;

  if (parsed.length !== 1 || !result) {
    violations.push(`npm pack dry-run returned ${parsed.length} artifacts`);
    return {};
  }

  return result;
}

function checkRequiredFiles(packedFiles: ReadonlySet<string>) {
  for (const requiredFile of REQUIRED_FILES) {
    if (!packedFiles.has(requiredFile)) {
      violations.push(
        `package artifact missing required file: ${requiredFile}`,
      );
    }
  }
}

function checkExportTargets(
  packageJson: PackageJson,
  packedFiles: ReadonlySet<string>,
) {
  for (const [exportName, exportTarget] of Object.entries(
    packageJson.exports ?? {},
  )) {
    const targets = [exportTarget.types, exportTarget.default].filter(
      (target): target is string => typeof target === "string",
    );

    for (const target of targets) {
      const normalizedTarget = normalizePath(target.replace(/^\.\//, ""));
      if (!packedFiles.has(normalizedTarget)) {
        violations.push(
          `${exportName} target is missing from package artifact: ${normalizedTarget}`,
        );
      }
    }
  }
}

function checkForbiddenFiles(packedFiles: ReadonlySet<string>) {
  for (const packedFile of packedFiles) {
    if (
      FORBIDDEN_ARTIFACT_PATHS.some((prefix) => packedFile.startsWith(prefix))
    ) {
      violations.push(
        `package artifact includes forbidden path: ${packedFile}`,
      );
      continue;
    }

    if (
      FORBIDDEN_ARTIFACT_SEGMENTS.some((segment) =>
        packedFile.includes(segment),
      )
    ) {
      violations.push(
        `package artifact includes forbidden path: ${packedFile}`,
      );
    }
  }
}

function normalizePath(value: string) {
  return value.replaceAll("\\", "/");
}
