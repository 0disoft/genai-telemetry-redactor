import { describe, expect, it } from "vitest";

import { isSafeTelemetryLabel } from "../src/safe-label.js";

describe("isSafeTelemetryLabel", () => {
  it.each([
    ["GitLab personal access token", ["gl", "pat-", "A".repeat(20)].join("")],
    ["PyPI token", ["py", "pi-", "A".repeat(85)].join("")],
    [
      "compact JWT",
      [
        "eyJ",
        "A".repeat(12),
        ".",
        "eyJ",
        "B".repeat(12),
        ".",
        "C".repeat(24),
      ].join(""),
    ],
  ])("rejects a %s shape", (_label, value) => {
    expect(isSafeTelemetryLabel(value)).toBe(false);
  });

  it.each(["gitlab-runner", "pypi-package", "eyJ.invalid", "model:v1"])(
    "keeps ordinary bounded label %s",
    (value) => {
      expect(isSafeTelemetryLabel(value)).toBe(true);
    },
  );
});
