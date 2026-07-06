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

export type ReplacementTokenPolicy = (reason: RedactionReason) => string;

export type RedactionLimits = {
  maxStringLength?: number;
  maxObjectDepth?: number;
  maxObjectKeys?: number;
  maxArrayLength?: number;
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
  | "overlapping_detection"
  | "max_string_length_exceeded"
  | "max_object_depth_exceeded"
  | "max_object_keys_exceeded"
  | "max_array_length_exceeded"
  | "circular_reference"
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
  | "max_string_length_exceeded"
  | "max_object_depth_exceeded"
  | "max_object_keys_exceeded"
  | "max_array_length_exceeded"
  | "circular_reference"
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
