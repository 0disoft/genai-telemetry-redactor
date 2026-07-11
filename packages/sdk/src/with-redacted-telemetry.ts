import type {
  RedactionReport,
  RedactionResult,
  RedactionWarningCode,
  RedactionWarning,
  SafeRedactionErrorCode,
} from "../../core/src/index.js";
import { mergeReports } from "../../core/src/report.js";
import {
  redactOpenAICompatibleRequest,
  redactOpenAICompatibleResponse,
} from "../../openai-compatible/src/index.js";
import { mapRedactionReportToGenAIMetadata } from "../../otel/src/index.js";
import type {
  RedactedTelemetryReportContext,
  WithRedactedTelemetryOptions,
  WithRedactedTelemetryResult,
  WithRedactedTelemetryValue,
} from "./types.js";

const SAFE_CONTEXT_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REPORT_CONTEXT_KEYS = [
  "operationId",
  "attemptId",
  "idempotencyKey",
] as const;

export async function withRedactedTelemetry(
  options: WithRedactedTelemetryOptions,
): Promise<WithRedactedTelemetryResult> {
  try {
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
  } catch {
    return sdkFailure(
      "invalid_redaction_options",
      "Telemetry redaction options could not be safely inspected.",
    );
  }
}

async function withOpenAICompatibleRedactedTelemetry(
  options: WithRedactedTelemetryOptions,
): Promise<WithRedactedTelemetryResult> {
  const reportContext = sanitizeReportContext(options.reportContext);
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
  let telemetry = mapRedactionReportToGenAIMetadata(report, options.telemetry);
  const finalReport = invokeReportCallback(
    options,
    report,
    telemetry,
    reportContext,
  );
  if (finalReport !== report) {
    telemetry = mapRedactionReportToGenAIMetadata(
      finalReport,
      options.telemetry,
    );
  }

  const value: WithRedactedTelemetryValue = {
    redactedRequest: request.value,
    telemetry,
    report: finalReport,
    reportContext,
    warnings: finalReport.warnings,
  };

  if ("response" in options) {
    value.redactedResponse = redactedResponse;
  }

  return {
    ok: true,
    value,
    telemetry,
    report: finalReport,
    reportContext,
    warnings: finalReport.warnings,
  };
}

function failureFromRedaction<T>(
  result: Extract<RedactionResult<T>, { ok: false }>,
  options: WithRedactedTelemetryOptions,
  priorReports: readonly RedactionReport[],
): WithRedactedTelemetryResult {
  const reportContext = sanitizeReportContext(options.reportContext);
  const report = mergeReports([...priorReports, result.report]);
  let telemetry = mapRedactionReportToGenAIMetadata(report, options.telemetry);
  const finalReport = invokeReportCallback(
    options,
    report,
    telemetry,
    reportContext,
  );
  if (finalReport !== report) {
    telemetry = mapRedactionReportToGenAIMetadata(
      finalReport,
      options.telemetry,
    );
  }

  return {
    ok: false,
    telemetry,
    report: finalReport,
    reportContext,
    warnings: finalReport.warnings,
    error: result.error,
  };
}

function invokeReportCallback(
  options: WithRedactedTelemetryOptions,
  report: RedactionReport,
  telemetry: ReturnType<typeof mapRedactionReportToGenAIMetadata>,
  context: RedactedTelemetryReportContext,
): RedactionReport {
  if (!options.onReport) {
    return report;
  }

  try {
    options.onReport(report, telemetry, context);
    return report;
  } catch {
    return appendReportWarning(report, "report_callback_failed");
  }
}

function appendReportWarning(
  report: RedactionReport,
  code: RedactionWarningCode,
): RedactionReport {
  return {
    ...report,
    warnings: [...report.warnings, { code }],
  };
}

function sanitizeReportContext(
  input: WithRedactedTelemetryOptions["reportContext"],
): RedactedTelemetryReportContext {
  const context: RedactedTelemetryReportContext = {
    droppedContextKeys: [],
  };

  if (!isRecord(input)) {
    return context;
  }

  for (const key of REPORT_CONTEXT_KEYS) {
    const value = input[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value === "string" && SAFE_CONTEXT_LABEL_PATTERN.test(value)) {
      context[key] = value;
      continue;
    }

    context.droppedContextKeys.push(key);
  }

  return context;
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
  const reportContext = sanitizeReportContext(options?.reportContext);

  return {
    ok: false,
    telemetry,
    report,
    reportContext,
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
