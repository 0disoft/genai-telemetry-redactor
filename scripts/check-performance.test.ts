import { describe, expect, it } from "vitest";

import path from "node:path";

import {
  createPerformanceResult,
  evaluatePerformanceResults,
  percentile,
  resolvePerformanceOutputPath,
} from "./check-performance.js";

describe("performance baseline", () => {
  it("calculates nearest-rank percentiles", () => {
    expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(percentile([5, 1, 3, 2, 4], 95)).toBe(5);
  });

  it("reports median and p95 budget violations independently", () => {
    const violations = evaluatePerformanceResults(
      {
        schemaVersion: "genai-telemetry-redactor/performance-baseline/v1",
        cases: {
          sample: { iterations: 5, maxMedianMs: 10, maxP95Ms: 20 },
        },
      },
      {
        sample: { iterations: 5, medianMs: 11, p95Ms: 21, maxMs: 22 },
      },
    );
    expect(violations).toHaveLength(2);
  });

  it("reports a missing benchmark case", () => {
    expect(
      evaluatePerformanceResults(
        {
          schemaVersion: "genai-telemetry-redactor/performance-baseline/v1",
          cases: {
            missing: { iterations: 1, maxMedianMs: 1, maxP95Ms: 2 },
          },
        },
        {},
      ),
    ).toEqual(["performance case did not run: missing"]);
  });

  it("builds a comparable result with bounded CI provenance", () => {
    const cases = {
      sample: { iterations: 5, medianMs: 1, p95Ms: 2, maxMs: 3 },
    };
    expect(
      createPerformanceResult(cases, {
        generatedAt: new Date("2026-07-18T00:00:00.000Z"),
        environment: {
          GITHUB_SHA: "A".repeat(40),
          GITHUB_RUN_ID: "123456",
          GITHUB_RUN_ATTEMPT: "2",
        },
        nodeVersion: "v24.0.0",
        platform: "linux",
        arch: "x64",
      }),
    ).toEqual({
      schemaVersion: "genai-telemetry-redactor/performance-result/v1",
      generatedAt: "2026-07-18T00:00:00.000Z",
      source: {
        commit: "a".repeat(40),
        workflowRunId: "123456",
        workflowRunAttempt: 2,
      },
      environment: {
        nodeVersion: "v24.0.0",
        platform: "linux",
        arch: "x64",
      },
      cases,
    });
  });

  it("drops malformed workflow provenance instead of copying arbitrary values", () => {
    const result = createPerformanceResult(
      {},
      {
        generatedAt: new Date("2026-07-18T00:00:00.000Z"),
        environment: {
          GITHUB_SHA: "not-a-commit",
          GITHUB_RUN_ID: "12 34",
          GITHUB_RUN_ATTEMPT: "0",
        },
        nodeVersion: "v24.0.0",
        platform: "linux",
        arch: "x64",
      },
    );
    expect(result.source).toEqual({
      commit: null,
      workflowRunId: null,
      workflowRunAttempt: null,
    });
  });

  it("allows JSON output only below the artifact directory", () => {
    const root = path.resolve("repository-root");
    expect(
      resolvePerformanceOutputPath(
        ["--", "--output", "artifacts/performance-node-24.json"],
        root,
      ),
    ).toBe(path.join(root, "artifacts", "performance-node-24.json"));
    expect(() =>
      resolvePerformanceOutputPath(
        ["--output", "artifacts/../performance.json"],
        root,
      ),
    ).toThrow("performance output must be a JSON file under artifacts/");
    expect(() =>
      resolvePerformanceOutputPath(
        ["--output", "artifacts/performance.txt"],
        root,
      ),
    ).toThrow("performance output must be a JSON file under artifacts/");
  });
});
