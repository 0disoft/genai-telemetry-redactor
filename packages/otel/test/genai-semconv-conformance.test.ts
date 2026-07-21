import { describe, expect, it } from "vitest";
import type { RedactionReport } from "../../core/src/index.js";
import { mapRedactionReportToGenAIMetadata } from "../src/index.js";
import { PINNED_OTEL_GENAI_SEMCONV } from "./fixtures/otel-genai-semconv-150760c6.js";

const EMPTY_REPORT: RedactionReport = {
  status: "unchanged",
  totalRedactions: 0,
  countsByReason: {},
  warnings: [],
};

describe("pinned OpenTelemetry GenAI semantic convention", () => {
  it("emits only the official GenAI attributes represented by the pinned fixture", () => {
    const result = mapRedactionReportToGenAIMetadata(EMPTY_REPORT, {
      operationName: "chat",
      providerName: "openai",
      requestModel: "model_example",
      responseModel: "model_example",
      tokenUsage: {
        inputTokens: 12,
        outputTokens: 8,
        totalTokens: 20,
      },
    });
    const officialAttributes = Object.entries(result.attributes).filter(
      ([name]) => name.startsWith("gen_ai."),
    );

    expect(officialAttributes.map(([name]) => name).sort()).toEqual(
      Object.keys(PINNED_OTEL_GENAI_SEMCONV.mappedAttributes).sort(),
    );
    for (const [name, value] of officialAttributes) {
      const expectedType =
        PINNED_OTEL_GENAI_SEMCONV.mappedAttributes[
          name as keyof typeof PINNED_OTEL_GENAI_SEMCONV.mappedAttributes
        ];
      expect(typeof value).toBe(
        "string" === expectedType ? "string" : "number",
      );
      if (expectedType === "int") {
        expect(Number.isSafeInteger(value)).toBe(true);
      }
    }

    expect(result.attributes).not.toHaveProperty("gen_ai.usage.total_tokens");
    expect(result.attributes).toHaveProperty(
      "genai_redactor.usage.total_tokens",
      20,
    );
  });

  it("records the exact upstream snapshot used for the mapping contract", () => {
    const result = mapRedactionReportToGenAIMetadata(EMPTY_REPORT);

    expect(result.attributes).toMatchObject({
      "genai_redactor.otel.genai.semconv.label":
        "opentelemetry-semconv-genai-150760c6252a",
      "genai_redactor.otel.genai.semconv.status":
        PINNED_OTEL_GENAI_SEMCONV.status,
      "genai_redactor.otel.genai.semconv.source": `${PINNED_OTEL_GENAI_SEMCONV.repository}/commit/${PINNED_OTEL_GENAI_SEMCONV.commit}`,
    });
  });
});
