import { describe, expect, it } from "vitest";
import type { RedactionReport } from "../../core/src/index.js";
import { mapRedactionReportToGenAIMetadata } from "../src/index.js";

describe("mapRedactionReportToGenAIMetadata", () => {
  it("maps safe redaction report fields and metadata into attributes", () => {
    const result = mapRedactionReportToGenAIMetadata(
      {
        status: "redacted",
        totalRedactions: 3,
        countsByReason: {
          email: 1,
          api_key: 2,
        },
        warnings: [{ code: "malformed_tool_arguments", path: "$.hidden" }],
      },
      {
        operationName: "chat",
        providerName: "openai-compatible",
        requestModel: "model_example",
        responseModel: "model_example",
        tokenUsage: {
          inputTokens: 12,
          outputTokens: 34,
          totalTokens: 46,
        },
        latencyMs: 25.5,
      },
    );

    expect(result.attributes).toMatchObject({
      "genai_redactor.otel.genai.semconv.label":
        "opentelemetry-semconv-genai-main",
      "genai_redactor.otel.genai.semconv.status": "development",
      "genai_redactor.content_capture.enabled": false,
      "genai_redactor.redaction.status": "redacted",
      "genai_redactor.redaction.total_count": 3,
      "genai_redactor.redaction.reason_count.email": 1,
      "genai_redactor.redaction.reason_count.api_key": 2,
      "genai_redactor.redaction.warning_codes": ["malformed_tool_arguments"],
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "openai-compatible",
      "gen_ai.request.model": "model_example",
      "gen_ai.response.model": "model_example",
      "gen_ai.usage.input_tokens": 12,
      "gen_ai.usage.output_tokens": 34,
      "gen_ai.usage.total_tokens": 46,
      "genai_redactor.operation.duration_ms": 25.5,
    });
    expect(result.droppedMetadataKeys).toEqual([]);
  });

  it("does not put redactor-owned attributes under the official gen_ai namespace", () => {
    const result = mapRedactionReportToGenAIMetadata({
      status: "redacted",
      totalRedactions: 1,
      countsByReason: {
        email: 1,
      },
      warnings: [{ code: "streaming_content_omitted" }],
    });

    expect(
      Object.keys(result.attributes).filter((name) =>
        name.startsWith("gen_ai.telemetry."),
      ),
    ).toEqual([]);
  });

  it("aggregates custom reason identifiers without exporting custom labels", () => {
    const result = mapRedactionReportToGenAIMetadata({
      status: "redacted",
      totalRedactions: 3,
      countsByReason: {
        "custom:project_user_id": 1,
        "custom:user@example.invalid": 2,
      },
      warnings: [],
    });

    expect(result.attributes).toMatchObject({
      "genai_redactor.redaction.reason_count.custom": 3,
    });
    expect(JSON.stringify(result.attributes)).not.toContain(
      "user@example.invalid",
    );
  });

  it("drops unsafe metadata values instead of exporting raw-looking content", () => {
    const result = mapRedactionReportToGenAIMetadata(
      {
        status: "unchanged",
        totalRedactions: 0,
        countsByReason: {},
        warnings: [],
      },
      {
        operationName: "chat user@example.invalid",
        providerName: "https://example.invalid/provider",
        requestModel: "model/example",
        errorClass: "TimeoutError",
        tokenUsage: {
          inputTokens: -1,
        },
        latencyMs: Number.NaN,
      },
    );

    const output = JSON.stringify(result);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("https://example.invalid/provider");
    expect(output).not.toContain("model/example");
    expect(result.attributes["error.type"]).toBe("TimeoutError");
    expect(result.attributes).toMatchObject({
      "genai_redactor.redaction.metadata_dropped_count": 5,
    });
    expect(result.droppedMetadataKeys).toEqual([
      "operationName",
      "providerName",
      "requestModel",
      "latencyMs",
      "tokenUsage.inputTokens",
    ]);
  });

  it("keeps content capture disabled even when runtime input requests it", () => {
    const result = mapRedactionReportToGenAIMetadata(
      {
        status: "redacted",
        totalRedactions: 1,
        countsByReason: {
          email: 1,
        },
        warnings: [],
      },
      {
        captureContent: true,
      } as unknown as Parameters<typeof mapRedactionReportToGenAIMetadata>[1],
    );

    expect(result.attributes).toMatchObject({
      "genai_redactor.content_capture.enabled": false,
      "genai_redactor.redaction.metadata_dropped_count": 1,
    });
    expect(result.droppedMetadataKeys).toEqual(["captureContent"]);
  });

  it("exports warning codes only, not paths or detector identifiers", () => {
    const report: RedactionReport = {
      status: "failed",
      totalRedactions: 0,
      countsByReason: {},
      warnings: [
        {
          code: "detector_failed",
          detectorId: "custom:detector_with_private_name",
          path: "$.messages[0].content",
        },
        {
          code: "unsupported_provider_shape",
          path: "$.unknown",
        },
      ],
    };

    const result = mapRedactionReportToGenAIMetadata(report);
    const output = JSON.stringify(result.attributes);

    expect(result.attributes).toMatchObject({
      "genai_redactor.redaction.status": "failed",
      "genai_redactor.redaction.warning_codes": [
        "detector_failed",
        "unsupported_provider_shape",
      ],
    });
    expect(output).not.toContain("custom:detector_with_private_name");
    expect(output).not.toContain("$.messages[0].content");
    expect(output).not.toContain("$.unknown");
  });
});
