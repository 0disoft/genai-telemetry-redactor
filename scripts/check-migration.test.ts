import { describe, expect, it } from "vitest";

import {
  compareMigrationContracts,
  migrationGuideSection,
  type MigrationContract,
} from "./check-migration.js";

const contract: MigrationContract = {
  nodeEngine: ">=22.14.0",
  packageExports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
  },
  publicApiInventorySha256: "a".repeat(64),
  sdkApiInventorySha256: "b".repeat(64),
  defaultDetectors: [{ id: "builtin:email", reasons: ["email"] }],
  replacementTokens: { email: "[REDACTED:email]" },
  warningCodes: ["detector_failed"],
  otelSemconvCommit: "c".repeat(40),
};

describe("migration contract", () => {
  it("accepts an unchanged normalized contract", () => {
    expect(
      compareMigrationContracts(contract, structuredClone(contract)),
    ).toEqual([]);
  });

  it("rejects a changed public contract", () => {
    const changed = structuredClone(contract);
    changed.defaultDetectors.push({ id: "builtin:url", reasons: ["url"] });
    expect(compareMigrationContracts(contract, changed)).toHaveLength(1);
  });

  it("extracts only the requested migration section", () => {
    const source =
      "# Guide\n\n## 0.3.0\nCurrent migration.\n\n## 0.2.7\nOlder migration.\n";
    expect(migrationGuideSection(source, "0.3.0")).toBe(
      "## 0.3.0\nCurrent migration.",
    );
    expect(migrationGuideSection(source, "0.4.0")).toBeUndefined();
  });
});
