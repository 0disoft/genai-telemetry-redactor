import { describe, expect, it, vi } from "vitest";
import { createRedactionProfile, type Detector } from "../../core/src/index.js";
import { withRedactedTelemetry } from "../src/index.js";

describe("withRedactedTelemetry", () => {
  it("shares one total-duration deadline across request and response", async () => {
    let now = 2_000;
    let detectorRuns = 0;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    const detector: Detector = {
      id: "test:sdk-deadline",
      reasons: ["custom:deadline"],
      detect() {
        now += detectorRuns === 0 ? 6 : 5;
        detectorRuns += 1;
        return [];
      },
    };

    try {
      const result = await withRedactedTelemetry({
        adapter: "openai-compatible",
        request: { prompt: "safe request" },
        response: { choices: [{ text: "safe response" }] },
        redaction: {
          builtInDetectors: false,
          detectors: [detector],
          limits: { maxTotalDurationMs: 10 },
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }

      expect(result.error.code).toBe("max_total_duration_exceeded");
      expect(result.telemetry.attributes).toMatchObject({
        "genai_redactor.redaction.status": "failed",
        "genai_redactor.content_capture.enabled": false,
      });
      expect(detectorRuns).toBe(2);
    } finally {
      clock.mockRestore();
    }
  });

  it("shares detection and detector-run budgets across request and response", async () => {
    let detectorRuns = 0;
    const detector: Detector = {
      id: "test:sdk-run-budget",
      reasons: ["custom:run_budget"],
      detect(input) {
        detectorRuns += 1;
        const start = input.indexOf("cust_1234");
        return start < 0
          ? []
          : [
              {
                reason: "custom:run_budget",
                start,
                end: start + "cust_1234".length,
              },
            ];
      },
    };
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: { prompt: "Customer cust_1234" },
      response: { choices: [{ text: "Customer cust_1234" }] },
      redaction: {
        builtInDetectors: false,
        detectors: [detector],
        limits: {
          maxTotalDetections: 1,
          maxDetectorRuns: 1,
        },
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("max_detector_runs_exceeded");
    expect(detectorRuns).toBe(1);
    expect(JSON.stringify(result)).not.toContain("cust_1234");
  });

  it("reuses a redaction profile through the SDK wrapper", async () => {
    const creation = createRedactionProfile({
      builtInDetectors: ["email"],
    });
    expect(creation.ok).toBe(true);
    if (!creation.ok) {
      return;
    }

    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid with token_example_value",
      },
      redaction: { profile: creation.value },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result.value)).toContain("token_example_value");
    expect(result.value.report.totalRedactions).toBe(1);
  });

  it("redacts OpenAI-compatible request and response and returns safe telemetry", async () => {
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        messages: [
          {
            role: "user",
            content: "Contact user@example.invalid",
          },
        ],
      },
      response: {
        choices: [
          {
            message: {
              role: "assistant",
              content: "Use token_example_value",
            },
          },
        ],
      },
      telemetry: {
        operationName: "chat",
        providerName: "openai-compatible",
        requestModel: "model_example",
        responseModel: "model_example",
        tokenUsage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
        },
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("token_example_value");
    expect(result.value.report.totalRedactions).toBe(2);
    expect(result.value.telemetry.attributes).toMatchObject({
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai-compatible",
      "genai_redactor.redaction.total_count": 2,
      "genai_redactor.content_capture.enabled": false,
    });
  });

  it("fails closed without returning partially redacted payloads", async () => {
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        messages: [
          {
            role: "user",
            content: "Contact user@example.invalid",
          },
        ],
      },
      response: {
        output_text: "token_example_value",
      },
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect("value" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain("token_example_value");
    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.telemetry.attributes).toMatchObject({
      "genai_redactor.redaction.status": "failed",
      "genai_redactor.content_capture.enabled": false,
    });
  });

  it("invokes report callbacks with reports and metadata only", async () => {
    const seen: string[] = [];
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid",
      },
      onReport(report, telemetry) {
        seen.push(JSON.stringify({ report, telemetry }));
      },
    });

    expect(result.ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0]).not.toContain("user@example.invalid");
    expect(seen[0]).toContain("genai_redactor.redaction.total_count");
  });

  it("preserves redacted results when report callbacks throw", async () => {
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid",
      },
      onReport() {
        throw new Error("synthetic callback failure");
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(result.value.report.warnings).toContainEqual(
      expect.objectContaining({ code: "report_callback_failed" }),
    );
    expect(
      result.value.telemetry.attributes[
        "genai_redactor.redaction.warning_codes"
      ],
    ).toEqual(["report_callback_failed"]);
  });

  it("passes safe idempotency context to report callbacks and results", async () => {
    const contexts: unknown[] = [];
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid",
      },
      reportContext: {
        operationId: "chat:op_123",
        attemptId: "attempt-1",
        idempotencyKey: "job_123",
      },
      onReport(_report, _telemetry, context) {
        contexts.push(context);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(contexts).toEqual([
      {
        operationId: "chat:op_123",
        attemptId: "attempt-1",
        idempotencyKey: "job_123",
        droppedContextKeys: [],
      },
    ]);
    expect(result.value.reportContext).toEqual(contexts[0]);
  });

  it("drops unsafe idempotency context values without leaking them", async () => {
    const contexts: unknown[] = [];
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid",
      },
      reportContext: {
        operationId: "user@example.invalid",
        attemptId: "attempt-1",
        idempotencyKey: "https://example.invalid/private",
      },
      onReport(_report, _telemetry, context) {
        contexts.push(context);
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.reportContext).toEqual({
      attemptId: "attempt-1",
      droppedContextKeys: ["operationId", "idempotencyKey"],
    });
    expect(contexts).toEqual([result.value.reportContext]);
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain(
      "https://example.invalid/private",
    );
  });

  it("fails closed for unknown adapter names from JavaScript callers", async () => {
    const result = await withRedactedTelemetry({
      adapter: "bad-adapter",
      request: {
        prompt: "Contact user@example.invalid",
      },
    } as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed when SDK option inspection throws", async () => {
    const options = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "adapter") {
            throw new Error("synthetic SDK options trap");
          }
          return undefined;
        },
      },
    );

    const result = await withRedactedTelemetry(options as never);

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("invalid_redaction_options");
    expect(result.telemetry.attributes).toMatchObject({
      "genai_redactor.redaction.status": "failed",
      "genai_redactor.content_capture.enabled": false,
    });
  });

  it("does not let adapter-specific options override core detector policy", async () => {
    const result = await withRedactedTelemetry({
      adapter: "openai-compatible",
      request: {
        prompt: "Contact user@example.invalid",
      },
      openAICompatible: {
        builtInDetectors: false,
      } as never,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(result.value.report.totalRedactions).toBe(1);
  });
});
