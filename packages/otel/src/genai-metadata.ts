import type { RedactionReport } from "../../core/src/index.js";
import { REDACTION_WARNING_CODES } from "../../core/src/warning-codes.js";
import type {
  OtelGenAIAttributeMap,
  OtelGenAIMetadata,
  OtelGenAIMetadataOptions,
} from "./types.js";

const DEFAULT_CONVENTION_LABEL = "opentelemetry-semconv-genai-main";
const GENAI_SEMCONV_STATUS = "development";
const GENAI_SEMCONV_SOURCE =
  "https://github.com/open-telemetry/semantic-conventions-genai";
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BUILT_IN_REASON_KEYS = new Set([
  "email",
  "bearer_token",
  "api_key",
  "url",
]);
const SAFE_WARNING_CODES = new Set<string>(REDACTION_WARNING_CODES);

export function mapRedactionReportToGenAIMetadata(
  report: RedactionReport,
  options: OtelGenAIMetadataOptions = {},
): OtelGenAIMetadata {
  try {
    return mapRedactionReportToGenAIMetadataInternal(report, options);
  } catch {
    return failedMapperMetadata();
  }
}

function mapRedactionReportToGenAIMetadataInternal(
  report: RedactionReport,
  options: OtelGenAIMetadataOptions,
): OtelGenAIMetadata {
  const droppedMetadataKeys: string[] = [];
  const redactionStatus = safeRedactionStatus(
    report.status,
    droppedMetadataKeys,
  );
  const attributes: OtelGenAIAttributeMap = {
    "genai_redactor.otel.genai.semconv.label": safeLabelOrDefault(
      options.conventionLabel,
      DEFAULT_CONVENTION_LABEL,
    ),
    "genai_redactor.otel.genai.semconv.status": GENAI_SEMCONV_STATUS,
    "genai_redactor.otel.genai.semconv.source": GENAI_SEMCONV_SOURCE,
    "genai_redactor.content_capture.enabled": false,
    "genai_redactor.redaction.status": redactionStatus,
    "genai_redactor.redaction.total_count": nonNegativeInteger(
      report.totalRedactions,
    ),
  };
  assignSafeLabel(
    attributes,
    droppedMetadataKeys,
    "gen_ai.operation.name",
    "operationName",
    options.operationName,
  );
  assignSafeLabel(
    attributes,
    droppedMetadataKeys,
    "gen_ai.provider.name",
    "providerName",
    options.providerName,
  );
  assignSafeLabel(
    attributes,
    droppedMetadataKeys,
    "gen_ai.request.model",
    "requestModel",
    options.requestModel,
  );
  assignSafeLabel(
    attributes,
    droppedMetadataKeys,
    "gen_ai.response.model",
    "responseModel",
    options.responseModel,
  );
  assignSafeLabel(
    attributes,
    droppedMetadataKeys,
    "error.type",
    "errorClass",
    options.errorClass,
  );

  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "genai_redactor.operation.duration_ms",
    "latencyMs",
    options.latencyMs,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "genai_redactor.redaction.duration_ms",
    "report.timings.durationMs",
    report.timings?.durationMs,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "genai_redactor.redaction.detector_duration_ms",
    "report.timings.detectorDurationMs",
    report.timings?.detectorDurationMs,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "genai_redactor.redaction.detector_runs",
    "report.timings.detectorRuns",
    report.timings?.detectorRuns,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "gen_ai.usage.input_tokens",
    "tokenUsage.inputTokens",
    options.tokenUsage?.inputTokens,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "gen_ai.usage.output_tokens",
    "tokenUsage.outputTokens",
    options.tokenUsage?.outputTokens,
  );
  assignSafeNumber(
    attributes,
    droppedMetadataKeys,
    "gen_ai.usage.total_tokens",
    "tokenUsage.totalTokens",
    options.tokenUsage?.totalTokens,
  );

  if ((options as { captureContent?: unknown }).captureContent === true) {
    droppedMetadataKeys.push("captureContent");
  }

  const reasonCounts = safeReasonCounts(report.countsByReason);
  for (const [reason, count] of Object.entries(reasonCounts)) {
    attributes[`genai_redactor.redaction.reason_count.${reason}`] = count;
  }

  const warningCodes = uniqueSortedWarningCodes(report, droppedMetadataKeys);
  if (warningCodes.length > 0) {
    attributes["genai_redactor.redaction.warning_codes"] = warningCodes;
  }

  if (droppedMetadataKeys.length > 0) {
    attributes["genai_redactor.redaction.metadata_dropped_count"] =
      droppedMetadataKeys.length;
  }

  return {
    attributes,
    droppedMetadataKeys,
  };
}

function failedMapperMetadata(): OtelGenAIMetadata {
  return {
    attributes: {
      "genai_redactor.otel.genai.semconv.label": DEFAULT_CONVENTION_LABEL,
      "genai_redactor.otel.genai.semconv.status": GENAI_SEMCONV_STATUS,
      "genai_redactor.otel.genai.semconv.source": GENAI_SEMCONV_SOURCE,
      "genai_redactor.content_capture.enabled": false,
      "genai_redactor.redaction.status": "failed",
      "genai_redactor.redaction.total_count": 0,
      "genai_redactor.redaction.metadata_dropped_count": 1,
    },
    droppedMetadataKeys: ["mapperInput"],
  };
}

function safeLabelOrDefault(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  return isSafeLabel(value) ? value : fallback;
}

function assignSafeLabel(
  attributes: OtelGenAIAttributeMap,
  droppedMetadataKeys: string[],
  attributeName: string,
  optionName: string,
  value: string | undefined,
) {
  if (value === undefined) {
    return;
  }

  if (!isSafeLabel(value)) {
    droppedMetadataKeys.push(optionName);
    return;
  }

  attributes[attributeName] = value;
}

function assignSafeNumber(
  attributes: OtelGenAIAttributeMap,
  droppedMetadataKeys: string[],
  attributeName: string,
  optionName: string,
  value: number | undefined,
) {
  if (value === undefined) {
    return;
  }

  if (!Number.isFinite(value) || value < 0) {
    droppedMetadataKeys.push(optionName);
    return;
  }

  attributes[attributeName] = value;
}

function isSafeLabel(value: string) {
  return SAFE_LABEL_PATTERN.test(value);
}

function nonNegativeInteger(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return Math.trunc(value);
}

function safeReasonCounts(countsByReason: Record<string, number>) {
  const counts: Record<string, number> = {};

  for (const [reason, count] of Object.entries(countsByReason)) {
    const key = BUILT_IN_REASON_KEYS.has(reason) ? reason : "custom";
    counts[key] = (counts[key] ?? 0) + nonNegativeInteger(count);
  }

  return counts;
}

function safeRedactionStatus(
  value: unknown,
  droppedMetadataKeys: string[],
): RedactionReport["status"] {
  if (value === "unchanged" || value === "redacted" || value === "failed") {
    return value;
  }

  droppedMetadataKeys.push("report.status");
  return "failed";
}

function uniqueSortedWarningCodes(
  report: RedactionReport,
  droppedMetadataKeys: string[],
) {
  const safeCodes: string[] = [];
  let dropped = false;

  for (const warning of report.warnings) {
    if (
      warning !== null &&
      typeof warning === "object" &&
      SAFE_WARNING_CODES.has(warning.code)
    ) {
      safeCodes.push(warning.code);
    } else {
      dropped = true;
    }
  }

  if (dropped) {
    droppedMetadataKeys.push("report.warnings");
  }

  return Array.from(new Set(safeCodes)).sort();
}
