import { describe, expect, it } from "vitest";

import { evaluatePerformanceResults, percentile } from "./check-performance.js";

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
});
