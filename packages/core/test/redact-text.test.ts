import { describe, expect, it } from "vitest";
import type { Detector } from "../src/index.js";
import { redactText } from "../src/index.js";

describe("redactText", () => {
  it("redacts email, api-key-like, bearer token, and URL values", async () => {
    const tokenHeader = ["Bearer", "token_example_value"].join(" ");
    const input = [
      "Contact user@example.invalid",
      `using ${tokenHeader}`,
      "and key_example_value",
      "at https://example.invalid/private.",
    ].join(" ");

    const result = await redactText(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toContain("[REDACTED:email]");
    expect(result.value).toContain("[REDACTED:bearer_token]");
    expect(result.value).toContain("[REDACTED:api_key]");
    expect(result.value).toContain("[REDACTED:url]");
    expect(result.value).not.toContain("user@example.invalid");
    expect(result.value).not.toContain("token_example_value");
    expect(result.value).not.toContain("key_example_value");
    expect(result.value).not.toContain("https://example.invalid/private");
    expect(result.report.totalRedactions).toBe(4);
    expect(result.report.countsByReason).toMatchObject({
      email: 1,
      bearer_token: 1,
      api_key: 1,
      url: 1,
    });
  });

  it("supports custom detectors without preserving original values", async () => {
    const detector: Detector = {
      id: "custom:account",
      reasons: ["custom:account_id"],
      detect(input) {
        const marker = "acct_example_value";
        const start = input.indexOf(marker);
        return start >= 0
          ? [
              {
                reason: "custom:account_id",
                start,
                end: start + marker.length,
              },
            ]
          : [];
      },
    };

    const result = await redactText("Account acct_example_value created.", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Account [REDACTED:custom:account_id] created.");
    expect(result.value).not.toContain("acct_example_value");
  });

  it("uses UTF-16 code unit ranges without splitting surrogate pairs", async () => {
    const input = "Prefix 😀 suffix";
    const detector: Detector = {
      id: "custom:emoji",
      reasons: ["custom:emoji"],
      detect() {
        return [
          {
            reason: "custom:emoji",
            start: 7,
            end: 9,
          },
        ];
      },
    };

    const result = await redactText(input, {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Prefix [REDACTED:custom:emoji] suffix");
    expect(result.value).not.toContain("😀");
  });

  it("fails closed when a detector range splits a surrogate pair", async () => {
    const detector: Detector = {
      id: "custom:split-surrogate",
      reasons: ["custom:split_surrogate"],
      detect() {
        return [
          {
            reason: "custom:split_surrogate",
            start: 7,
            end: 8,
          },
        ];
      },
    };

    const result = await redactText("Prefix 😀 suffix", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_detection_range");
    expect(result.report.status).toBe("failed");
    expect(result.report.totalRedactions).toBe(0);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "invalid_detection_range",
        detectorId: "custom:split-surrogate",
        reason: "custom:split_surrogate",
      }),
    );
  });

  it("redacts repeated detections and reports counts by reason", async () => {
    const result = await redactText(
      "First user@example.invalid and second user@example.invalid",
      {
        builtInDetectors: ["email"],
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe(
      "First [REDACTED:email] and second [REDACTED:email]",
    );
    expect(result.report.totalRedactions).toBe(2);
    expect(result.report.countsByReason.email).toBe(2);
  });

  it("keeps the longest detection for the same start and warns on overlap", async () => {
    const detector: Detector = {
      id: "custom:overlap",
      reasons: ["custom:short", "custom:long"],
      detect() {
        return [
          {
            reason: "custom:short",
            start: 6,
            end: 12,
          },
          {
            reason: "custom:long",
            start: 6,
            end: 24,
          },
        ];
      },
    };

    const result = await redactText("Value acct_example_value done", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Value [REDACTED:custom:long] done");
    expect(result.report.totalRedactions).toBe(1);
    expect(result.report.countsByReason["custom:long"]).toBe(1);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        code: "overlapping_detection",
        reason: "custom:short",
      }),
    );
  });

  it("fails closed when a detector throws", async () => {
    const detector: Detector = {
      id: "custom:throwing",
      reasons: ["custom:throws"],
      detect() {
        throw new Error("synthetic detector failure");
      },
    };

    const result = await redactText("Sensitive user@example.invalid", {
      detectors: [detector],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("detector_failed");
    expect(result.error.message).not.toContain("user@example.invalid");
    expect(result.report.status).toBe("failed");
    expect(result.report.totalRedactions).toBe(0);
  });

  it("fails closed when a detector returns an invalid range", async () => {
    const detector: Detector = {
      id: "custom:invalid",
      reasons: ["custom:invalid"],
      detect() {
        return [
          {
            reason: "custom:invalid",
            start: 5,
            end: 2,
          },
        ];
      },
    };

    const result = await redactText("input", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_detection_range");
  });

  it("fails closed when input exceeds maxStringLength", async () => {
    const result = await redactText("too long", {
      limits: {
        maxStringLength: 3,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_string_length_exceeded");
  });
});
