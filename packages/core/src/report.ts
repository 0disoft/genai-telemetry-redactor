import type {
  RedactionReason,
  RedactionReport,
  RedactionTimings,
  RedactionWarning,
  SafeRedactionError,
} from "./types.js";

export type ReportDelta = {
  status: "unchanged" | "redacted";
  totalRedactions: number;
  countsByReason: Record<string, number>;
  warnings: RedactionWarning[];
};

export type RedactionReportAccumulator = {
  add(report: RedactionReport): void;
  addWarnings(warnings: readonly RedactionWarning[]): void;
  markFailed(): void;
  snapshot(): RedactionReport;
};

export function createEmptyReport(
  warnings: RedactionWarning[] = [],
  timings?: RedactionTimings,
): RedactionReport {
  return {
    status: "unchanged",
    totalRedactions: 0,
    countsByReason: {},
    warnings,
    ...timingsField(timings),
  };
}

export function createFailedReport(
  warnings: RedactionWarning[],
  timings?: RedactionTimings,
): RedactionReport {
  return {
    status: "failed",
    totalRedactions: 0,
    countsByReason: {},
    warnings,
    ...timingsField(timings),
  };
}

export function createFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
  fields: Pick<SafeRedactionError, "detectorId"> = {},
  timings?: RedactionTimings,
) {
  return {
    ok: false as const,
    report: createFailedReport(warnings, timings),
    warnings,
    error: {
      code,
      message,
      ...fields,
    },
  };
}

export function createRedactionReport(
  reasons: readonly RedactionReason[],
  warnings: RedactionWarning[],
  timings?: RedactionTimings,
): RedactionReport {
  const countsByReason: Record<string, number> = {};

  for (const reason of reasons) {
    countsByReason[reason] = (countsByReason[reason] ?? 0) + 1;
  }

  return {
    status: reasons.length > 0 ? "redacted" : "unchanged",
    totalRedactions: reasons.length,
    countsByReason,
    warnings,
    ...timingsField(timings),
  };
}

export function mergeReports(
  reports: readonly RedactionReport[],
): RedactionReport {
  const accumulator = createRedactionReportAccumulator();
  for (const report of reports) {
    accumulator.add(report);
  }

  return accumulator.snapshot();
}

export function createRedactionReportAccumulator(): RedactionReportAccumulator {
  const countsByReason: Record<string, number> = {};
  const warnings: RedactionWarning[] = [];
  let durationMs = 0;
  let detectorDurationMs = 0;
  let detectorRuns = 0;
  let nodesVisited = 0;
  let stringCodeUnits = 0;
  let hasTimings = false;
  let totalRedactions = 0;
  let failed = false;

  return {
    add(report) {
      if (report.status === "failed") {
        failed = true;
      }

      totalRedactions += report.totalRedactions;
      warnings.push(...report.warnings);
      if (report.timings) {
        hasTimings = true;
        durationMs += report.timings.durationMs ?? 0;
        detectorDurationMs += report.timings.detectorDurationMs ?? 0;
        detectorRuns += report.timings.detectorRuns ?? 0;
        nodesVisited += report.timings.nodesVisited ?? 0;
        stringCodeUnits += report.timings.stringCodeUnits ?? 0;
      }

      for (const [reason, count] of Object.entries(report.countsByReason)) {
        countsByReason[reason] = (countsByReason[reason] ?? 0) + count;
      }
    },
    addWarnings(nextWarnings) {
      warnings.push(...nextWarnings);
    },
    markFailed() {
      failed = true;
    },
    snapshot() {
      return {
        status: failed
          ? "failed"
          : totalRedactions > 0
            ? "redacted"
            : "unchanged",
        totalRedactions,
        countsByReason: { ...countsByReason },
        warnings: [...warnings],
        ...timingsField(
          hasTimings
            ? {
                durationMs,
                detectorDurationMs,
                detectorRuns,
                nodesVisited,
                stringCodeUnits,
              }
            : undefined,
        ),
      };
    },
  };
}

function timingsField(
  timings: RedactionTimings | undefined,
): { timings: RedactionTimings } | Record<string, never> {
  const safeTimings = normalizeTimings(timings);
  return safeTimings ? { timings: safeTimings } : {};
}

function normalizeTimings(
  timings: RedactionTimings | undefined,
): RedactionTimings | undefined {
  if (!timings) {
    return undefined;
  }

  const next: RedactionTimings = {};
  assignNonNegativeNumber(next, "durationMs", timings.durationMs);
  assignNonNegativeNumber(
    next,
    "detectorDurationMs",
    timings.detectorDurationMs,
  );
  assignNonNegativeNumber(next, "detectorRuns", timings.detectorRuns);
  assignNonNegativeNumber(next, "nodesVisited", timings.nodesVisited);
  assignNonNegativeNumber(next, "stringCodeUnits", timings.stringCodeUnits);

  return Object.keys(next).length > 0 ? next : undefined;
}

function assignNonNegativeNumber<K extends keyof RedactionTimings>(
  target: RedactionTimings,
  key: K,
  value: RedactionTimings[K] | undefined,
) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return;
  }

  target[key] = value;
}
