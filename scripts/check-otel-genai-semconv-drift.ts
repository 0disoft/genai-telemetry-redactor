import { pathToFileURL } from "node:url";

import { OTEL_GENAI_SEMCONV_COMMIT } from "../packages/otel/src/semconv.js";

const UPSTREAM_REPOSITORY = "open-telemetry/semantic-conventions-genai";
const UPSTREAM_API_URL = `https://api.github.com/repos/${UPSTREAM_REPOSITORY}/commits/main`;
const UPSTREAM_WEB_URL = `https://github.com/${UPSTREAM_REPOSITORY}`;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/u;

type FetchResponse = Pick<Response, "json" | "ok" | "status">;
type FetchLike = (input: string, init?: RequestInit) => Promise<FetchResponse>;

export interface SemconvDriftResult {
  status: "current" | "drift";
  pinnedCommit: string;
  latestCommit: string;
  pinnedCommitUrl: string;
  latestCommitUrl: string;
  compareUrl: string;
}

function assertCommit(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !COMMIT_PATTERN.test(value)) {
    throw new Error(`${field} must be a 40-character lowercase Git commit SHA`);
  }
}

export function extractLatestCommit(payload: unknown): string {
  if (typeof payload !== "object" || payload === null || !("sha" in payload)) {
    throw new Error("GitHub API response did not contain a commit SHA");
  }

  const sha = payload.sha;
  assertCommit(sha, "GitHub API commit SHA");
  return sha;
}

export function buildSemconvDriftResult(
  pinnedCommit: string,
  latestCommit: string,
): SemconvDriftResult {
  assertCommit(pinnedCommit, "Pinned commit SHA");
  assertCommit(latestCommit, "Latest commit SHA");

  return {
    status: pinnedCommit === latestCommit ? "current" : "drift",
    pinnedCommit,
    latestCommit,
    pinnedCommitUrl: `${UPSTREAM_WEB_URL}/commit/${pinnedCommit}`,
    latestCommitUrl: `${UPSTREAM_WEB_URL}/commit/${latestCommit}`,
    compareUrl: `${UPSTREAM_WEB_URL}/compare/${pinnedCommit}...${latestCommit}`,
  };
}

export async function fetchLatestSemconvCommit(
  fetchImpl: FetchLike = fetch,
): Promise<string> {
  const response = await fetchImpl(UPSTREAM_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "genai-telemetry-redactor-semconv-drift",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  }

  return extractLatestCommit(await response.json());
}

export async function checkSemconvDrift(
  fetchImpl: FetchLike = fetch,
): Promise<SemconvDriftResult> {
  const latestCommit = await fetchLatestSemconvCommit(fetchImpl);
  return buildSemconvDriftResult(OTEL_GENAI_SEMCONV_COMMIT, latestCommit);
}

async function main(): Promise<void> {
  const result = await checkSemconvDrift();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Unknown drift-check failure";
    process.stderr.write(
      `OpenTelemetry GenAI semconv drift check failed: ${message}\n`,
    );
    process.exitCode = 1;
  });
}
