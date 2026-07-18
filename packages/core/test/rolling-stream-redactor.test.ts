import { describe, expect, it } from "vitest";

import {
  createBuiltInRollingTextStreamRedactor,
  type Detector,
} from "../src/index.js";
import { findBuiltInSafeFlushIndex } from "../src/rolling-stream-redactor.js";

describe("createBuiltInRollingTextStreamRedactor", () => {
  it.each([
    ["email", "Contact user@example.invalid now ", "[REDACTED:email]"],
    ["url", "Open https://service.example.invalid/path now ", "[REDACTED:url]"],
    ["api key", "Use key_example_value now ", "[REDACTED:api_key]"],
    [
      "bearer token",
      "Send (Bearer abcdefghij) now ",
      "[REDACTED:bearer_token]",
    ],
  ])(
    "redacts a split %s at every chunk boundary before emitting it",
    async (_label, input, replacement) => {
      for (let split = 1; split < input.length; split += 1) {
        const stream = createBuiltInRollingTextStreamRedactor();
        const first = await stream.push(input.slice(0, split));
        const second = await stream.push(input.slice(split));
        const final = await stream.close();
        expect(first.ok && second.ok && final.ok).toBe(true);
        if (!first.ok || !second.ok || !final.ok) {
          continue;
        }
        const output =
          first.value.content + second.value.content + final.value.content;
        expect(output).not.toContain(
          input.match(
            /user@example\.invalid|https:\/\/service\.example\.invalid\/path|key_example_value|abcdefghij/,
          )?.[0],
        );
        expect(output).toContain(replacement);
      }
    },
  );

  it("retains a bearer scheme and whitespace until its token is complete", async () => {
    const stream = createBuiltInRollingTextStreamRedactor();

    const first = await stream.push("safe (Bearer ");
    const second = await stream.push("abcdefghij ");
    const final = await stream.close();

    expect(first.ok && second.ok && final.ok).toBe(true);
    if (!first.ok || !second.ok || !final.ok) {
      return;
    }
    expect(first.value).toEqual({
      content: "safe (",
      final: false,
      retainedCodeUnits: "Bearer ".length,
    });
    expect(second.value.content).toBe("Bearer [REDACTED:bearer_token] ");
    expect(final.value).toEqual({
      content: "",
      final: true,
      retainedCodeUnits: 0,
    });
  });

  it("retains an unfinished whitespace-free segment and flushes it on close", async () => {
    const stream = createBuiltInRollingTextStreamRedactor();
    const pushed = await stream.push("ordinary");
    const closed = await stream.close();

    expect(pushed.ok && closed.ok).toBe(true);
    if (!pushed.ok || !closed.ok) {
      return;
    }
    expect(pushed.value.content).toBe("");
    expect(pushed.value.retainedCodeUnits).toBe(8);
    expect(closed.value).toEqual({
      content: "ordinary",
      final: true,
      retainedCodeUnits: 0,
    });
  });

  it("fails closed when a whitespace-free segment exceeds the buffer", async () => {
    const stream = createBuiltInRollingTextStreamRedactor({
      limits: { maxStreamBufferLength: 8 },
    });
    const first = await stream.push("https://");
    const second = await stream.push("x");
    const closed = await stream.close();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    expect(closed.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe("max_stream_buffer_length_exceeded");
      expect(JSON.stringify(second)).not.toContain("https://x");
    }
  });

  it("bounds only the retained suffix, not a flushable input chunk", async () => {
    const stream = createBuiltInRollingTextStreamRedactor({
      limits: { maxStreamBufferLength: 8 },
    });
    const result = await stream.push("safe words can flush ");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe("safe words can flush ");
      expect(result.value.retainedCodeUnits).toBe(0);
    }
  });

  it("rejects custom detectors and profile-shaped runtime input", async () => {
    const detector: Detector = {
      id: "custom:stream",
      reasons: ["custom:stream"],
      detect: () => [],
    };
    const custom = createBuiltInRollingTextStreamRedactor({
      detectors: [detector],
    } as never);
    const profileShaped = createBuiltInRollingTextStreamRedactor({
      profile: {},
    } as never);

    const customResult = await custom.push("safe ");
    const profileResult = await profileShaped.push("safe ");
    expect(customResult.ok).toBe(false);
    expect(profileResult.ok).toBe(false);
    if (!customResult.ok && !profileResult.ok) {
      expect(customResult.error.code).toBe("invalid_redaction_options");
      expect(profileResult.error.code).toBe("invalid_redaction_options");
    }
  });

  it("keeps total string and detection budgets across flushes", async () => {
    const lengthLimited = createBuiltInRollingTextStreamRedactor({
      limits: { maxTotalStringLength: 8 },
    });
    expect((await lengthLimited.push("safe ")).ok).toBe(true);
    const lengthFailure = await lengthLimited.push("text ");
    expect(lengthFailure.ok).toBe(false);
    if (!lengthFailure.ok) {
      expect(lengthFailure.error.code).toBe("max_total_string_length_exceeded");
    }

    const detectionLimited = createBuiltInRollingTextStreamRedactor({
      builtInDetectors: ["email"],
      limits: { maxTotalDetections: 1 },
    });
    expect((await detectionLimited.push("one@example.invalid ")).ok).toBe(true);
    const detectionFailure = await detectionLimited.push(
      "two@example.invalid ",
    );
    expect(detectionFailure.ok).toBe(false);
    if (!detectionFailure.ok) {
      expect(detectionFailure.error.code).toBe("max_total_detections_exceeded");
      expect(JSON.stringify(detectionFailure)).not.toContain(
        "two@example.invalid",
      );
    }

    const detectorRunLimited = createBuiltInRollingTextStreamRedactor({
      builtInDetectors: ["email"],
      limits: { maxDetectorRuns: 1 },
    });
    expect((await detectorRunLimited.push("first safe ")).ok).toBe(true);
    const detectorRunFailure = await detectorRunLimited.push("second safe ");
    expect(detectorRunFailure.ok).toBe(false);
    if (!detectorRunFailure.ok) {
      expect(detectorRunFailure.error.code).toBe("max_detector_runs_exceeded");
    }
  });

  it("fails both overlapping operations without releasing content", async () => {
    const stream = createBuiltInRollingTextStreamRedactor();
    const firstPromise = stream.push("user@example.invalid ");
    const secondPromise = stream.push("late content ");
    const [first, second] = await Promise.all([firstPromise, secondPromise]);

    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect(JSON.stringify({ first, second })).not.toContain(
      "user@example.invalid",
    );
    if (!first.ok && !second.ok) {
      expect(first.error.code).toBe("stream_operation_in_progress");
      expect(second.error.code).toBe("stream_operation_in_progress");
    }
  });

  it("keeps terminal close semantics", async () => {
    const stream = createBuiltInRollingTextStreamRedactor();
    const firstClose = await stream.close();
    const latePush = await stream.push("late content");
    const secondClose = await stream.close();

    expect(firstClose.ok).toBe(true);
    expect(latePush.ok).toBe(false);
    expect(secondClose.ok).toBe(false);
    if (!latePush.ok && !secondClose.ok) {
      expect(latePush.error.code).toBe("stream_closed");
      expect(secondClose.error.code).toBe("stream_already_closed");
    }
  });
});

describe("findBuiltInSafeFlushIndex", () => {
  it("flushes through ordinary whitespace", () => {
    expect(findBuiltInSafeFlushIndex("safe text ")).toBe("safe text ".length);
  });

  it.each(["Bearer ", "Token\t", "Basic   ", "safe (Bearer "])(
    "retains bearer detection context for %s",
    (input) => {
      const boundary = findBuiltInSafeFlushIndex(input);
      expect(input.slice(boundary)).toMatch(/^(?:Bearer|Token|Basic)\s+$/i);
    },
  );
});
