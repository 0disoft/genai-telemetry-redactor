import type { RedactionReport } from "../../core/src/index.js";
import type {
  OtelGenAIAttributeMap,
  OtelGenAIMetadata,
  OtelGenAIMetadataOptions,
} from "./types.js";

const DEFAULT_CONVENTION_LABEL = "UNDECIDED";
const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BUILT_IN_REASON_KEYS = new Set([
  "email",
  "bearer_token",
  "api_key",
  "url",
]);

export function mapRedactionReportToGenAIMetadata(
  report: RedactionReport,
  options: OtelGenAIMetadataOptions = {},
): OtelGenAIMetadata {
  const attributes: OtelGenAIAttributeMap = {
    "gen_ai.telemetry.redaction.convention": safeLabelOrDefault(
      options.conventionLabel,
      DEFAULT_CONVENTION_LABEL,
    ),
    "gen_ai.telemetry.content_capture_enabled": false,
    "gen_ai.telemetry.redaction.status": report.status,
    "gen_ai.telemetry.redaction.total_count": nonNegativeInteger(
      report.totalRedactions,
    ),
  };
  const droppedMetadataKeys: string[] = [];

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
    "gen_ai.system",
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
    "gen_ai.operation.duration_ms",
    "latencyMs",
    options.latencyMs,
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
    attributes[`gen_ai.telemetry.redaction.reason_count.${reason}`] = count;
  }

  const warningCodes = uniqueSortedWarningCodes(report);
  if (warningCodes.length > 0) {
    attributes["gen_ai.telemetry.redaction.warning_codes"] = warningCodes;
  }

  if (droppedMetadataKeys.length > 0) {
    attributes["gen_ai.telemetry.redaction.metadata_dropped_count"] =
      droppedMetadataKeys.length;
  }

  return {
    attributes,
    droppedMetadataKeys,
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

function uniqueSortedWarningCodes(report: RedactionReport) {
  return Array.from(
    new Set(report.warnings.map((warning) => warning.code)),
  ).sort();
}
