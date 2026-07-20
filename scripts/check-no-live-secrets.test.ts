import { describe, expect, it } from "vitest";

import {
  matchingSecretPatternNames,
  resolveScanOptions,
  scanRoots,
} from "./check-no-live-secrets.js";

describe("secret scanner", () => {
  it.each([
    ["gitlab-token", ["gl", "pat-", "A".repeat(20)].join("")],
    ["pypi-token", ["py", "pi-", "B".repeat(85)].join("")],
    [
      "compact-jwt",
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
  ])(
    "detects %s content without storing a live-looking fixture",
    (name, value) => {
      expect(matchingSecretPatternNames(value)).toContain(name);
    },
  );

  it("includes final package output only when requested", () => {
    expect(scanRoots(resolveScanOptions([]))).not.toContain("dist");
    expect(scanRoots(resolveScanOptions(["--include-dist"]))).toContain("dist");
  });

  it("rejects ambiguous or unknown scanner options", () => {
    expect(() => resolveScanOptions(["--docs-only", "--include-dist"])).toThrow(
      "cannot be combined",
    );
    expect(() => resolveScanOptions(["--unexpected"])).toThrow(
      "unknown secret scanner option",
    );
  });
});
