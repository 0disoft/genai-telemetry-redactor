import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const PACKAGE_DIR = path.join(ROOT, "packages");
const LIBRARY_PUBLIC_API_DOC = path.join(
  ROOT,
  "docs",
  "library",
  "public-api.md",
);
const SDK_PUBLIC_API_DOC = path.join(ROOT, "docs", "sdk", "public-api.md");
const PUBLIC_API_MARKERS = {
  start: "<!-- public-api-inventory:start -->",
  end: "<!-- public-api-inventory:end -->",
};
const SDK_API_MARKERS = {
  start: "<!-- sdk-api-inventory:start -->",
  end: "<!-- sdk-api-inventory:end -->",
};

const violations: string[] = [];
const packageNames = await listInternalPackageNames();
const packageExports = await collectPackageExports(packageNames);
const expectedLibraryInventory = buildLibraryInventory(packageExports);
const expectedSdkInventory = new Map([
  ["./sdk", packageExports.get("sdk") ?? []],
]);

const libraryDocInventory = parseInventoryBlock(
  await readFile(LIBRARY_PUBLIC_API_DOC, "utf8"),
  PUBLIC_API_MARKERS,
  "docs/library/public-api.md",
);
const sdkDocInventory = parseInventoryBlock(
  await readFile(SDK_PUBLIC_API_DOC, "utf8"),
  SDK_API_MARKERS,
  "docs/sdk/public-api.md",
);

compareInventory(
  "docs/library/public-api.md",
  expectedLibraryInventory,
  libraryDocInventory,
);
compareInventory(
  "docs/sdk/public-api.md",
  expectedSdkInventory,
  sdkDocInventory,
);

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

async function collectPackageExports(packageNames: readonly string[]) {
  const exportsByPackage = new Map<string, string[]>();

  for (const packageName of packageNames) {
    const indexPath = path.join(PACKAGE_DIR, packageName, "src", "index.ts");
    const sourceText = await readFile(indexPath, "utf8");
    exportsByPackage.set(
      packageName,
      collectNamedExports(indexPath, sourceText),
    );
  }

  return exportsByPackage;
}

function collectNamedExports(fileName: string, sourceText: string) {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        names.add(element.name.text);
      }
    }
  }

  return [...names].sort((left, right) => left.localeCompare(right));
}

function buildLibraryInventory(packageExports: ReadonlyMap<string, string[]>) {
  const inventory = new Map<string, string[]>();
  const rootExports = [...packageExports.values()]
    .flat()
    .sort((left, right) => left.localeCompare(right));

  inventory.set(".", rootExports);

  for (const [packageName, names] of packageExports) {
    inventory.set(`./${packageName}`, names);
  }

  return inventory;
}

function parseInventoryBlock(
  sourceText: string,
  markers: { start: string; end: string },
  docName: string,
) {
  const start = sourceText.indexOf(markers.start);
  const end = sourceText.indexOf(markers.end);

  if (start === -1 || end === -1 || end <= start) {
    violations.push(`${docName} is missing a valid public API inventory block`);
    return new Map<string, string[]>();
  }

  const block = sourceText.slice(start + markers.start.length, end);
  const inventory = new Map<string, string[]>();
  let currentExport: string | undefined;

  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    const heading = /^### Export `([^`]+)`$/.exec(line);
    if (heading?.[1]) {
      currentExport = heading[1];
      inventory.set(currentExport, []);
      continue;
    }

    const bullet = /^- `([^`]+)`$/.exec(line);
    if (bullet?.[1]) {
      if (!currentExport) {
        violations.push(`${docName} has export item outside an export heading`);
        continue;
      }

      inventory.get(currentExport)?.push(bullet[1]);
    }
  }

  for (const [exportName, names] of inventory) {
    inventory.set(
      exportName,
      [...names].sort((left, right) => left.localeCompare(right)),
    );
  }

  return inventory;
}

function compareInventory(
  docName: string,
  expected: ReadonlyMap<string, string[]>,
  actual: ReadonlyMap<string, string[]>,
) {
  const expectedExports = [...expected.keys()].sort((left, right) =>
    left.localeCompare(right),
  );
  const actualExports = [...actual.keys()].sort((left, right) =>
    left.localeCompare(right),
  );

  if (expectedExports.join("\n") !== actualExports.join("\n")) {
    violations.push(
      `${docName} export inventory drift: expected ${expectedExports.join(", ")}, got ${actualExports.join(", ")}`,
    );
  }

  for (const exportName of expectedExports) {
    const expectedNames = expected.get(exportName) ?? [];
    const actualNames = actual.get(exportName) ?? [];

    if (expectedNames.join("\n") !== actualNames.join("\n")) {
      violations.push(
        `${docName} ${exportName} symbol inventory drift: expected ${expectedNames.join(", ")}, got ${actualNames.join(", ")}`,
      );
    }
  }
}
