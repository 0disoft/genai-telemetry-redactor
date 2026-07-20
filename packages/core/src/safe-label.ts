const SAFE_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CREDENTIAL_SHAPED_LABEL_PATTERNS = [
  /^(?:sk|pk)-(?:proj-)?[A-Za-z0-9_-]{8,}$/,
  /^(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{8,}$/i,
  /^glpat-[A-Za-z0-9_-]{8,}$/i,
  /^pypi-[A-Za-z0-9_-]{85,}$/i,
  /^xox[baprs]-[A-Za-z0-9-]{8,}$/i,
  /^(?:AKIA|ASIA)[A-Z0-9]{12,}$/,
  /^(?:npm_|token_)[A-Za-z0-9_-]{8,}$/i,
  /^eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{8,}$/,
] as const;

export function isSafeTelemetryLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    SAFE_LABEL_PATTERN.test(value) &&
    !CREDENTIAL_SHAPED_LABEL_PATTERNS.some((pattern) => pattern.test(value))
  );
}
