import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type PackageJson = {
  exports?: Record<string, { types?: string; default?: string }>;
};

type InternalPackageJson = {
  name?: string;
  private?: boolean;
  type?: string;
};

const ROOT = process.cwd();
const PACKAGE_DIR = path.join(ROOT, "packages");
const ROOT_INDEX = path.join(ROOT, "src", "index.ts");
const PACKAGE_JSON = path.join(ROOT, "package.json");

const violations: string[] = [];
const packageJson = await readJson<PackageJson>(PACKAGE_JSON);
const packageNames = await listInternalPackageNames();
const expectedExports = new Map<string, string>([
  [".", "./dist/src/index.js"],
  ...packageNames.map(
    (name) => [`./${name}`, `./dist/packages/${name}/src/index.js`] as const,
  ),
]);

checkRootExports(packageJson);
await checkInternalPackages(packageNames);
await checkRootBarrel(packageNames);

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }
  process.exitCode = 1;
}

async function listInternalPackageNames() {
  const entries = await readdir(PACKAGE_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function checkRootExports(packageJson: PackageJson) {
  const actualExports = packageJson.exports ?? {};
  const actualExportNames = Object.keys(actualExports).sort((left, right) =>
    left.localeCompare(right),
  );
  const expectedExportNames = Array.from(expectedExports.keys()).sort(
    (left, right) => left.localeCompare(right),
  );

  if (actualExportNames.join("\n") !== expectedExportNames.join("\n")) {
    violations.push(
      `package.json exports drift: expected ${expectedExportNames.join(", ")}, got ${actualExportNames.join(", ")}`,
    );
  }

  for (const [exportName, expectedTarget] of expectedExports) {
    const actualTarget = actualExports[exportName];
    if (!actualTarget) {
      continue;
    }

    const expectedTypesTarget = expectedTarget.replace(/\.js$/, ".d.ts");

    if (actualTarget.types !== expectedTypesTarget) {
      violations.push(
        `${exportName} types target drift: expected ${expectedTypesTarget}, got ${actualTarget.types ?? "<missing>"}`,
      );
    }

    if (actualTarget.default !== expectedTarget) {
      violations.push(
        `${exportName} default target drift: expected ${expectedTarget}, got ${actualTarget.default ?? "<missing>"}`,
      );
    }
  }
}

async function checkInternalPackages(packageNames: readonly string[]) {
  for (const packageName of packageNames) {
    const packageRoot = path.join(PACKAGE_DIR, packageName);
    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageIndexPath = path.join(packageRoot, "src", "index.ts");
    const packageJson = await readJson<InternalPackageJson>(packageJsonPath);

    if (packageJson.private !== true) {
      violations.push(`packages/${packageName}/package.json must stay private`);
    }

    if (packageJson.type !== "module") {
      violations.push(
        `packages/${packageName}/package.json must use type module`,
      );
    }

    if (
      packageJson.name !== `@genai-telemetry-redactor/${packageName}-internal`
    ) {
      violations.push(
        `packages/${packageName}/package.json name drift: got ${packageJson.name ?? "<missing>"}`,
      );
    }

    await readFile(packageIndexPath, "utf8").catch(() => {
      violations.push(`packages/${packageName}/src/index.ts is missing`);
    });
  }
}

async function checkRootBarrel(packageNames: readonly string[]) {
  const rootIndex = await readFile(ROOT_INDEX, "utf8");
  for (const packageName of packageNames) {
    const expectedLine = `export * from "../packages/${packageName}/src/index.js";`;
    if (!rootIndex.includes(expectedLine)) {
      violations.push(`src/index.ts missing barrel export: ${expectedLine}`);
    }
  }
}

async function readJson<T>(target: string): Promise<T> {
  return JSON.parse(await readFile(target, "utf8")) as T;
}
