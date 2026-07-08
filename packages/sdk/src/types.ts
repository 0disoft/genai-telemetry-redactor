import type {
  RedactionOptions,
  RedactionReport,
  RedactionResult,
  RedactionWarning,
  SafeRedactionError,
} from "../../core/src/index.js";
import type { OpenAICompatibleOptions } from "../../openai-compatible/src/index.js";
import type {
  OtelGenAIMetadata,
  OtelGenAIMetadataOptions,
} from "../../otel/src/index.js";

export type RedactedTelemetryAdapter = "openai-compatible";

export type RedactedTelemetryReportContext = {
  operationId?: string;
  attemptId?: string;
  idempotencyKey?: string;
  droppedContextKeys: string[];
};

export type RedactedTelemetryReportCallback = (
  report: RedactionReport,
  telemetry: OtelGenAIMetadata,
  context: RedactedTelemetryReportContext,
) => void;

export type WithRedactedTelemetryOptions = {
  adapter: RedactedTelemetryAdapter;
  request: unknown;
  response?: unknown;
  redaction?: RedactionOptions;
  openAICompatible?: Pick<OpenAICompatibleOptions, "redactToolNames">;
  telemetry?: OtelGenAIMetadataOptions;
  reportContext?: {
    operationId?: string;
    attemptId?: string;
    idempotencyKey?: string;
  };
  onReport?: RedactedTelemetryReportCallback;
};

export type WithRedactedTelemetryValue = {
  redactedRequest: unknown;
  redactedResponse?: unknown;
  telemetry: OtelGenAIMetadata;
  report: RedactionReport;
  reportContext: RedactedTelemetryReportContext;
  warnings: RedactionWarning[];
};

export type WithRedactedTelemetryFailure = {
  ok: false;
  telemetry: OtelGenAIMetadata;
  report: RedactionReport;
  reportContext: RedactedTelemetryReportContext;
  warnings: RedactionWarning[];
  error: SafeRedactionError;
};

export type WithRedactedTelemetrySuccess =
  RedactionResult<WithRedactedTelemetryValue> & {
    ok: true;
    telemetry: OtelGenAIMetadata;
    reportContext: RedactedTelemetryReportContext;
  };

export type WithRedactedTelemetryResult =
  WithRedactedTelemetrySuccess | WithRedactedTelemetryFailure;
