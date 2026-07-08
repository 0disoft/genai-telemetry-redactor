import type {
  RedactionReport,
  RedactionResult,
  RedactionWarning,
  SafeRedactionErrorCode,
} from "../../core/src/index.js";
import {
  redactOpenAICompatibleRequest,
  redactOpenAICompatibleResponse,
} from "../../openai-compatible/src/index.js";
import { mapRedactionReportToGenAIMetadata } from "../../otel/src/index.js";
import type {
  WithRedactedTelemetryOptions,
  WithRedactedTelemetryResult,
  WithRedactedTelemetryValue,
} from "./types.js";

export async function withRedactedTelemetry(
  options: WithRedactedTelemetryOptions,
): Promise<WithRedactedTelemetryResult> {
  if (!isRecord(options)) {
    return sdkFailure(
      "invalid_redaction_options",
      "Telemetry redaction options must be an object.",
    );
  }

  switch (options.adapter) {
    case "openai-compatible":
      return withOpenAICompatibleRedactedTelemetry(options);
    default:
      return sdkFailure(
        "unsupported_provider_shape",
        "Unsupported telemetry redaction adapter.",
        options,
      );
  }
}

async function withOpenAICompatibleRedactedTelemetry(
  options: WithRedactedTelemetryOptions,
): Promise<WithRedactedTelemetryResult> {
  const adapterOptions = {
    ...options.redaction,
    redactToolNames: options.openAICompatible?.redactToolNames === true,
  };
  const reports: RedactionReport[] = [];

  const request = await redactOpenAICompatibleRequest(
    options.request,
    adapterOptions,
  );
  if (!request.ok) {
    return failureFromRedaction(request, options, reports);
  }
  reports.push(request.report);

  let redactedResponse: unknown;
  if ("response" in options) {
    const response = await redactOpenAICompatibleResponse(
      options.response,
      adapterOptions,
    );
    if (!response.ok) {
      return failureFromRedaction(response, options, reports);
    }

    reports.push(response.report);
    redactedResponse = response.value;
  }

  const report = mergeReports(reports);
  const telemetry = mapRedactionReportToGenAIMetadata(
    report,
    options.telemetry,
  );
  invokeReportCallback(options, report, telemetry);

  const value: WithRedactedTelemetryValue = {
    redactedRequest: request.value,
    telemetry,
    report,
    warnings: report.warnings,
  };

  if ("response" in options) {
    value.redactedResponse = redactedResponse;
  }

  return {
    ok: true,
    value,
    telemetry,
    report,
    warnings: report.warnings,
  };
}

function failureFromRedaction<T>(
  result: Extract<RedactionResult<T>, { ok: false }>,
  options: WithRedactedTelemetryOptions,
  priorReports: readonly RedactionReport[],
): WithRedactedTelemetryResult {
  const report = mergeReports([...priorReports, result.report]);
  const telemetry = mapRedactionReportToGenAIMetadata(
    report,
    options.telemetry,
  );
  invokeReportCallback(options, report, telemetry);

  return {
    ok: false,
    telemetry,
    report,
    warnings: report.warnings,
    error: result.error,
  };
}

function invokeReportCallback(
  options: WithRedactedTelemetryOptions,
  report: RedactionReport,
  telemetry: ReturnType<typeof mapRedactionReportToGenAIMetadata>,
) {
  options.onReport?.(report, telemetry);
}

function sdkFailure(
  code: SafeRedactionErrorCode,
  message: string,
  options?: Partial<WithRedactedTelemetryOptions>,
): WithRedactedTelemetryResult {
  const warnings: RedactionWarning[] = [{ code }];
  const report: RedactionReport = {
    status: "failed",
    totalRedactions: 0,
    countsByReason: {},
    warnings,
  };
  const telemetry = mapRedactionReportToGenAIMetadata(
    report,
    isRecord(options?.telemetry) ? options.telemetry : undefined,
  );

  return {
    ok: false,
    telemetry,
    report,
    warnings,
    error: {
      code,
      message,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeReports(reports: readonly RedactionReport[]): RedactionReport {
  const countsByReason: Record<string, number> = {};
  const warnings: RedactionWarning[] = [];
  let totalRedactions = 0;
  let failed = false;

  for (const report of reports) {
    if (report.status === "failed") {
      failed = true;
    }

    totalRedactions += report.totalRedactions;
    warnings.push(...report.warnings);

    for (const [reason, count] of Object.entries(report.countsByReason)) {
      countsByReason[reason] = (countsByReason[reason] ?? 0) + count;
    }
  }

  return {
    status: failed ? "failed" : totalRedactions > 0 ? "redacted" : "unchanged",
    totalRedactions,
    countsByReason,
    warnings,
  };
}
