import type {
  RedactionReason,
  RedactionReport,
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
): RedactionReport {
  return {
    status: "unchanged",
    totalRedactions: 0,
    countsByReason: {},
    warnings,
  };
}

export function createFailedReport(
  warnings: RedactionWarning[],
): RedactionReport {
  return {
    status: "failed",
    totalRedactions: 0,
    countsByReason: {},
    warnings,
  };
}

export function createFailure<T>(
  code: SafeRedactionError["code"],
  message: string,
  warnings: RedactionWarning[],
  fields: Pick<SafeRedactionError, "detectorId"> = {},
) {
  return {
    ok: false as const,
    report: createFailedReport(warnings),
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
  let totalRedactions = 0;
  let failed = false;

  return {
    add(report) {
      if (report.status === "failed") {
        failed = true;
      }

      totalRedactions += report.totalRedactions;
      warnings.push(...report.warnings);

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
      };
    },
  };
}
