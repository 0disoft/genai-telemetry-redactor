import { describe, expect, it } from "vitest";

import {
  buildSemconvDriftResult,
  extractLatestCommit,
  fetchLatestSemconvCommit,
} from "./check-otel-genai-semconv-drift.js";

const PINNED = "1111111111111111111111111111111111111111";
const LATEST = "2222222222222222222222222222222222222222";

describe("OpenTelemetry GenAI semconv drift check", () => {
  it("reports a pinned commit as current when upstream matches", () => {
    expect(buildSemconvDriftResult(PINNED, PINNED)).toMatchObject({
      status: "current",
      pinnedCommit: PINNED,
      latestCommit: PINNED,
    });
  });

  it("reports drift with inspectable commit and comparison URLs", () => {
    expect(buildSemconvDriftResult(PINNED, LATEST)).toEqual({
      status: "drift",
      pinnedCommit: PINNED,
      latestCommit: LATEST,
      pinnedCommitUrl: `https://github.com/open-telemetry/semantic-conventions-genai/commit/${PINNED}`,
      latestCommitUrl: `https://github.com/open-telemetry/semantic-conventions-genai/commit/${LATEST}`,
      compareUrl: `https://github.com/open-telemetry/semantic-conventions-genai/compare/${PINNED}...${LATEST}`,
    });
  });

  it("rejects malformed upstream responses", () => {
    expect(() => extractLatestCommit({ sha: "main" })).toThrow(
      "GitHub API commit SHA must be a 40-character lowercase Git commit SHA",
    );
    expect(() => extractLatestCommit({ message: "not found" })).toThrow(
      "GitHub API response did not contain a commit SHA",
    );
  });

  it("reports only the HTTP status for upstream failures", async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 403,
      json: async () => ({ secretLikeResponse: "must-not-be-read" }),
    });

    await expect(fetchLatestSemconvCommit(fetchImpl)).rejects.toThrow(
      "GitHub API request failed with HTTP 403",
    );
  });

  it("extracts a valid commit from a successful response", async () => {
    const fetchImpl = async () => ({
      ok: true,
      status: 200,
      json: async () => ({ sha: LATEST }),
    });

    await expect(fetchLatestSemconvCommit(fetchImpl)).resolves.toBe(LATEST);
  });
});
