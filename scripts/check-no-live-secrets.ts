import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DOCS_ONLY = process.argv.includes("--docs-only");

const INCLUDED_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".ssealed",
  "node_modules",
  "dist",
  "coverage",
  ".turbo",
  ".pnpm-store",
]);

const SECRET_PATTERNS: readonly { name: string; pattern: RegExp }[] = [
  {
    name: "openai-style-secret-key",
    pattern: /sk-[A-Za-z0-9_-]{12,}/,
  },
  {
    name: "literal-bearer-token",
    pattern: /Bearer [A-Za-z0-9._~-]{12,}/,
  },
  {
    name: "assigned-api-key",
    pattern: /api[_-]?key\s*[:=]\s*[A-Za-z0-9._~-]{12,}/i,
  },
];

const roots = DOCS_ONLY
  ? [
      "README.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
      "DEVELOPMENT.md",
      "SECURITY.md",
      "docs",
    ]
  : [
      "README.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
      "DEVELOPMENT.md",
      "SECURITY.md",
      "docs",
      "packages",
      "scripts",
    ];

const violations: string[] = [];

for (const root of roots) {
  await scanPath(path.join(ROOT, root));
}

if (violations.length > 0) {
  for (const violation of violations) {
    console.error(violation);
  }

  process.exitCode = 1;
}

async function scanPath(target: string): Promise<void> {
  const stats = await safeStat(target);
  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    if (SKIPPED_DIRECTORIES.has(path.basename(target))) {
      return;
    }

    const entries = await readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      await scanPath(path.join(target, entry.name));
    }
    return;
  }

  if (!stats.isFile() || !INCLUDED_EXTENSIONS.has(path.extname(target))) {
    return;
  }

  const content = await readFile(target, "utf8");
  for (const { name, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      violations.push(`${path.relative(ROOT, target)} matched ${name}`);
    }
  }
}

async function safeStat(target: string) {
  try {
    const { stat } = await import("node:fs/promises");
    return await stat(target);
  } catch {
    return undefined;
  }
}
