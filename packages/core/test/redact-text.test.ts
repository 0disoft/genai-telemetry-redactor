import { describe, expect, it } from "vitest";
import type { Detector } from "../src/index.js";
import { createRegexDetector, redactText } from "../src/index.js";

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
    expect(result.report.timings).toEqual(
      expect.objectContaining({
        durationMs: expect.any(Number),
        detectorDurationMs: expect.any(Number),
        detectorRuns: 4,
      }),
    );
  });

  it("redacts dash-style GenAI provider keys", async () => {
    const dashKey = ["sk", "proj", "examplevalue123456"].join("-");
    const result = await redactText(`Plain key ${dashKey} appeared.`);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("Plain key [REDACTED:api_key] appeared.");
    expect(JSON.stringify(result)).not.toContain(dashKey);
    expect(result.report.countsByReason.api_key).toBe(1);
  });

  it("redacts common cloud and source-control token shapes", async () => {
    const awsAccessKey = ["AKIA", "ABCDEFGHIJKLMNOP"].join("");
    const githubToken = ["ghp_", "a".repeat(36)].join("");
    const googleApiKey = ["AIza", "b".repeat(35)].join("");
    const slackToken = ["xoxb-", "c".repeat(12)].join("");
    const authToken = ["Basic", "token_example_value"].join(" ");
    const input = [
      awsAccessKey,
      githubToken,
      googleApiKey,
      slackToken,
      authToken,
    ].join(" ");

    const result = await redactText(input);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.report.countsByReason.api_key).toBe(4);
    expect(result.report.countsByReason.bearer_token).toBe(1);
    expect(JSON.stringify(result)).not.toContain(awsAccessKey);
    expect(JSON.stringify(result)).not.toContain(githubToken);
    expect(JSON.stringify(result)).not.toContain(googleApiKey);
    expect(JSON.stringify(result)).not.toContain(slackToken);
    expect(JSON.stringify(result)).not.toContain("token_example_value");
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

  it("creates custom regex detectors without requiring callers to calculate ranges", async () => {
    const detector = createRegexDetector({
      id: "custom:work-order",
      reason: "custom:work_order",
      pattern: /\bwo_[a-z0-9]{6}\b/i,
    });

    const result = await redactText("Review work order wo_ab12cd now.", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe(
      "Review work order [REDACTED:custom:work_order] now.",
    );
    expect(result.report.countsByReason["custom:work_order"]).toBe(1);
  });

  it("supports custom regex detector submatch ranges", async () => {
    const detector = createRegexDetector({
      id: "custom:header-token",
      reason: "custom:header_token",
      pattern: /\bToken\s+([A-Za-z0-9_]{8,})\b/,
      toDetection(match) {
        const token = match[1];
        if (!token) {
          return undefined;
        }

        const start = match.index + match[0].lastIndexOf(token);
        return {
          reason: "custom:header_token",
          start,
          end: start + token.length,
        };
      },
    });

    const result = await redactText(
      "Auth Token token_example_value accepted.",
      {
        builtInDetectors: false,
        detectors: [detector],
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe(
      "Auth Token [REDACTED:custom:header_token] accepted.",
    );
    expect(result.value).toContain("Token ");
    expect(result.value).not.toContain("token_example_value");
  });

  it("does not loop forever on zero-length custom regex matches", async () => {
    const detector = createRegexDetector({
      id: "custom:empty",
      reason: "custom:empty",
      pattern: /(?=.)/,
    });

    const result = await redactText("abc", {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toBe("abc");
    expect(result.report.totalRedactions).toBe(0);
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

  it("fails closed when different-start detections partially overlap", async () => {
    const detector: Detector = {
      id: "custom:partial-overlap",
      reasons: ["custom:first", "custom:second"],
      detect() {
        return [
          {
            reason: "custom:first",
            start: 0,
            end: 10,
          },
          {
            reason: "custom:second",
            start: 5,
            end: 20,
          },
        ];
      },
    };

    const input = "acct_example_value!! safe suffix";
    const result = await redactText(input, {
      builtInDetectors: false,
      detectors: [detector],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("overlapping_detection");
    expect(result.report.status).toBe("failed");
    expect(result.report.totalRedactions).toBe(0);
    expect(JSON.stringify(result)).not.toContain(input.slice(10, 20));
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

  it("fails closed when an async detector exceeds its timeout", async () => {
    const detector: Detector = {
      id: "custom:slow",
      reasons: ["custom:slow"],
      detect() {
        return new Promise(() => undefined);
      },
    };

    const result = await redactText("Sensitive user@example.invalid", {
      builtInDetectors: false,
      detectors: [detector],
      limits: {
        maxDetectorDurationMs: 1,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("detector_timeout");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("passes abort signals and detector deadlines to custom detectors", async () => {
    let sawSignal = false;
    let sawDeadline = false;
    const detector: Detector = {
      id: "custom:context",
      reasons: ["custom:context"],
      detect(_input, context) {
        sawSignal = context.signal instanceof AbortSignal;
        sawDeadline = typeof context.deadlineEpochMs === "number";
        return [];
      },
    };

    const result = await redactText("safe", {
      builtInDetectors: false,
      detectors: [detector],
      limits: {
        maxDetectorDurationMs: 1_000,
      },
    });

    expect(result.ok).toBe(true);
    expect(sawSignal).toBe(true);
    expect(sawDeadline).toBe(true);
  });

  it("fails closed when caller aborts redaction", async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await redactText("Sensitive user@example.invalid", {
      signal: controller.signal,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("redaction_aborted");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when replacement generation throws", async () => {
    const result = await redactText("Sensitive user@example.invalid", {
      replacement() {
        throw new Error("replacement policy failure");
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("replacement_failed");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when a detector emits an unsafe custom reason", async () => {
    const result = await redactText("Sensitive user@example.invalid", {
      builtInDetectors: false,
      detectors: [
        {
          id: "custom:unsafe",
          reasons: ["custom:user@example.invalid"],
          detect(input) {
            return [
              {
                reason: "custom:user@example.invalid",
                start: 10,
                end: input.length,
              },
            ];
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_redaction_reason");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
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

  it("fails closed when total operation duration is already exhausted", async () => {
    const result = await redactText("Contact user@example.invalid", {
      limits: {
        maxTotalDurationMs: 0,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_duration_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("aborts async detectors when total operation duration is exceeded", async () => {
    let detectorStarted = false;
    const detector: Detector = {
      id: "custom:slow-total",
      reasons: ["custom:slow_total"],
      detect() {
        detectorStarted = true;
        return new Promise(() => undefined);
      },
    };

    const result = await redactText("Sensitive user@example.invalid", {
      builtInDetectors: false,
      detectors: [detector],
      limits: {
        maxTotalDurationMs: 50,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_duration_exceeded");
    expect(detectorStarted).toBe(true);
    expect(result.error.detectorId).toBe("custom:slow-total");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when detector count exceeds the configured limit", async () => {
    const result = await redactText("Contact user@example.invalid", {
      limits: {
        maxDetectors: 3,
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detectors_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when detections exceed the configured limit", async () => {
    const result = await redactText(
      "First user@example.invalid second admin@example.invalid",
      {
        builtInDetectors: ["email"],
        limits: {
          maxTotalDetections: 1,
        },
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_total_detections_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain("admin@example.invalid");
  });
});
