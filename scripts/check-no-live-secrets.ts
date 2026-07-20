import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();

const INCLUDED_EXTENSIONS = new Set([
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

const ALWAYS_SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".ssealed",
  "node_modules",
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
    pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/g,
  },
  {
    name: "github-token",
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    name: "gitlab-token",
    pattern: /\bglpat-[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "pypi-token",
    pattern: /\bpypi-[A-Za-z0-9_-]{85,}\b/gi,
  },
  {
    name: "compact-jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{8,}\b/g,
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

type ScanOptions = {
  docsOnly: boolean;
  includeDist: boolean;
};

export function resolveScanOptions(arguments_: readonly string[]): ScanOptions {
  const supported = new Set(["--docs-only", "--include-dist"]);
  const unknown = arguments_.filter((argument) => !supported.has(argument));
  if (unknown.length > 0) {
    throw new Error(`unknown secret scanner option: ${unknown.join(", ")}`);
  }

  const docsOnly = arguments_.includes("--docs-only");
  const includeDist = arguments_.includes("--include-dist");
  if (docsOnly && includeDist) {
    throw new Error("--docs-only and --include-dist cannot be combined");
  }
  return { docsOnly, includeDist };
}

export function scanRoots(options: ScanOptions): readonly string[] {
  if (options.docsOnly) {
    return [
      "README.md",
      "AGENTS.md",
      "CONTRIBUTING.md",
      "DEVELOPMENT.md",
      "SECURITY.md",
      "docs",
    ];
  }

  const roots = [
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
  if (options.includeDist) {
    roots.push("dist");
  }
  return roots;
}

export function matchingSecretPatternNames(content: string): string[] {
  const names: string[] = [];
  for (const { name, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) {
      names.push(name);
    }
  }
  return names;
}

export async function findLiveSecretViolations(
  arguments_: readonly string[],
  root = ROOT,
): Promise<string[]> {
  const options = resolveScanOptions(arguments_);
  const violations: string[] = [];
  for (const scanRoot of scanRoots(options)) {
    await scanPath(path.join(root, scanRoot), root, options, violations);
  }
  return violations;
}

async function scanPath(
  target: string,
  root: string,
  options: ScanOptions,
  violations: string[],
): Promise<void> {
  const stats = await safeStat(target);
  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    const directoryName = path.basename(target);
    if (
      ALWAYS_SKIPPED_DIRECTORIES.has(directoryName) ||
      (directoryName === "dist" && !options.includeDist)
    ) {
      return;
    }

    const entries = await readdir(target, { withFileTypes: true });
    for (const entry of entries) {
      await scanPath(path.join(target, entry.name), root, options, violations);
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
        `${path.relative(root, target)} matched ${name} (${matches.length})`,
      );
    }
  }
}

async function safeStat(target: string) {
  try {
    return await stat(target);
  } catch {
    return undefined;
  }
}

async function run(): Promise<void> {
  const violations = await findLiveSecretViolations(process.argv.slice(2));
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`${violation}\n`);
    }
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    process.stderr.write(`Secret scan failed: ${message}\n`);
    process.exitCode = 1;
  });
}
