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
    pattern: /sk-[A-Za-z0-9_-]{12,}/g,
  },
  {
    name: "literal-auth-token",
    pattern:
      /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{12,}|\bToken\s+[A-Za-z0-9._~+/=-]{20,}/gi,
  },
  {
    name: "assigned-api-key",
    pattern: /api[_-]?key\s*[:=]\s*[A-Za-z0-9._~+/=-]{12,}/gi,
  },
  {
    name: "aws-access-key-id",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "github-token",
    pattern: /gh[pousr]_[A-Za-z0-9]{36}/g,
  },
  {
    name: "google-api-key",
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
  },
  {
    name: "slack-token",
    pattern: /xox[aboprst]-[A-Za-z0-9-]{10,}/g,
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
      "examples",
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
    const matches = Array.from(content.matchAll(pattern));
    if (matches.length > 0) {
      violations.push(
        `${path.relative(ROOT, target)} matched ${name} (${matches.length})`,
      );
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
