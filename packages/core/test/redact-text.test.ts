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
