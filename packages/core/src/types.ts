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
  | "max_string_length_exceeded";

export type RedactionWarning = {
  code: RedactionWarningCode;
  detectorId?: string;
  reason?: RedactionReason;
};

export type RedactionReport = {
  status: "unchanged" | "redacted" | "failed";
  totalRedactions: number;
  countsByReason: Record<string, number>;
  warnings: RedactionWarning[];
};

export type SafeRedactionErrorCode =
  "detector_failed" | "invalid_detection_range" | "max_string_length_exceeded";

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
