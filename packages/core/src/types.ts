export type BuiltInDetectorName = "email" | "bearer_token" | "api_key" | "url";

export type RedactionReason = BuiltInDetectorName | `custom:${string}`;

export type Detection = {
  reason: RedactionReason;
  start: number;
  end: number;
};

export type DetectionContext = {
  detectorId: string;
  inputLength: number;
};

export type Detector = {
  id: string;
  reasons: readonly RedactionReason[];
  detect(
    input: string,
    context: DetectionContext,
  ): Detection[] | Promise<Detection[]>;
};

export type RegexDetectorOptions = {
  id: string;
  reason: RedactionReason;
  pattern: RegExp;
  toDetection?: (match: RegExpExecArray) => Detection | undefined;
};

export type ReplacementTokenPolicy = (reason: RedactionReason) => string;

export type RedactionLimits = {
  maxStringLength?: number;
  maxTotalStringLength?: number;
  maxObjectDepth?: number;
  maxObjectKeys?: number;
  maxArrayLength?: number;
  maxTotalNodes?: number;
  maxTotalDetections?: number;
  maxDetectorRuns?: number;
};

export type RedactionOptions = {
  builtInDetectors?: readonly BuiltInDetectorName[] | false;
  detectors?: readonly Detector[];
  limits?: RedactionLimits;
  replacement?: ReplacementTokenPolicy;
};

export type RedactionWarningCode =
  | "detector_failed"
  | "invalid_detection_range"
  | "invalid_redaction_input"
  | "invalid_redaction_options"
  | "invalid_redaction_reason"
  | "overlapping_detection"
  | "replacement_failed"
  | "max_string_length_exceeded"
  | "max_total_string_length_exceeded"
  | "max_object_depth_exceeded"
  | "max_object_keys_exceeded"
  | "max_array_length_exceeded"
  | "max_total_nodes_exceeded"
  | "max_total_detections_exceeded"
  | "max_detector_runs_exceeded"
  | "circular_reference"
  | "unsafe_object_key"
  | "unsupported_json_like"
  | "unsupported_provider_shape"
  | "streaming_content_omitted"
  | "malformed_tool_arguments";

export type RedactionWarning = {
  code: RedactionWarningCode;
  detectorId?: string;
  reason?: RedactionReason;
  path?: string;
};

export type RedactionReport = {
  status: "unchanged" | "redacted" | "failed";
  totalRedactions: number;
  countsByReason: Record<string, number>;
  warnings: RedactionWarning[];
};

export type SafeRedactionErrorCode =
  | "detector_failed"
  | "invalid_detection_range"
  | "invalid_redaction_input"
  | "invalid_redaction_options"
  | "invalid_redaction_reason"
  | "replacement_failed"
  | "max_string_length_exceeded"
  | "max_total_string_length_exceeded"
  | "max_object_depth_exceeded"
  | "max_object_keys_exceeded"
  | "max_array_length_exceeded"
  | "max_total_nodes_exceeded"
  | "max_total_detections_exceeded"
  | "max_detector_runs_exceeded"
  | "circular_reference"
  | "unsafe_object_key"
  | "unsupported_json_like"
  | "unsupported_provider_shape";

export type SafeRedactionError = {
  code: SafeRedactionErrorCode;
  message: string;
  detectorId?: string;
};

export type RedactionResult<T> =
  | {
      ok: true;
      value: T;
      report: RedactionReport;
      warnings: RedactionWarning[];
    }
  | {
      ok: false;
      report: RedactionReport;
      warnings: RedactionWarning[];
      error: SafeRedactionError;
    };
