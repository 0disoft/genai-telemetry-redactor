import { access, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const EXAMPLES_DIR = path.join(ROOT, "examples");
const BUILT_ROOT_EXPORT = path.join(ROOT, "dist", "src", "index.js");

const violations: string[] = [];

try {
  await access(BUILT_ROOT_EXPORT);
} catch {
  violations.push(
    "examples require built package exports; run `pnpm run build` before check-examples",
  );
}

const examples = await listExampleFiles();
if (examples.length === 0) {
  violations.push(
    "examples directory must contain at least one TypeScript file",
  );
}

if (violations.length === 0) {
  for (const example of examples) {
    try {
      await import(pathToFileURL(example).href);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      violations.push(`${path.relative(ROOT, example)} failed: ${message}`);
    }
  }
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  process.exitCode = 1;
}

async function listExampleFiles() {
  const entries = await readdir(EXAMPLES_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => path.join(EXAMPLES_DIR, entry.name))
    .sort((left, right) => left.localeCompare(right));
}
