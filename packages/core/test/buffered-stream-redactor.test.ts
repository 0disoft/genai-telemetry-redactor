import { describe, expect, it } from "vitest";
import {
  createBufferedTextStreamRedactor,
  type Detector,
} from "../src/index.js";

describe("createBufferedTextStreamRedactor", () => {
  it("redacts sensitive values split across chunk boundaries on close", async () => {
    const stream = createBufferedTextStreamRedactor();

    const first = stream.push("Contact user@exam");
    const second = stream.push("ple.invalid before export");
    const result = await stream.close();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok || !result.ok) {
      return;
    }

    expect(first.value).toEqual({
      content: "",
      contentOmitted: true,
      warningCode: "streaming_content_omitted",
    });
    expect(second.value.content).toBe("");
    expect(result.value).not.toContain("user@example.invalid");
    expect(result.value).toContain("[REDACTED:email]");
    expect(result.report.totalRedactions).toBe(1);
  });

  it("fails closed on buffer overflow without returning partial content", async () => {
    const stream = createBufferedTextStreamRedactor({
      limits: {
        maxStreamBufferLength: 8,
      },
    });

    const result = stream.push("user@example.invalid");
    const closeResult = await stream.close();

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_stream_buffer_length_exceeded");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(closeResult.ok).toBe(false);
    expect(JSON.stringify(closeResult)).not.toContain("user@example.invalid");
  });

  it("fails closed when buffered detector execution fails", async () => {
    const detector: Detector = {
      id: "custom:stream-failure",
      reasons: ["custom:stream_failure"],
      detect() {
        throw new Error("synthetic stream detector failure");
      },
    };
    const stream = createBufferedTextStreamRedactor({
      builtInDetectors: false,
      detectors: [detector],
    });

    const pushResult = stream.push("user@example.invalid");
    const result = await stream.close();

    expect(pushResult.ok).toBe(true);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("detector_failed");
    expect(result.error.detectorId).toBe("custom:stream-failure");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });
});
