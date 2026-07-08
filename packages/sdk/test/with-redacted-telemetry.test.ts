import { describe, expect, it } from "vitest";
import { withRedactedTelemetry } from "../src/index.js";

describe("withRedactedTelemetry", () => {
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
