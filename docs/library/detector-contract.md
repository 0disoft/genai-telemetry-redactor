# Detector Contract

Status: Product-shaping

## Contract

Detectors inspect untrusted text and return ranges plus reason codes. They are
not proof of complete PII or DLP coverage.

## Required Properties

- Detector IDs and reason codes must be stable once released.
- Detection ranges use JavaScript UTF-16 code unit offsets, matching
  `String.length`, `RegExpExecArray.index`, and `String.prototype.slice`.
- Detection ranges are half-open `[start, end)` ranges. Both boundaries must be
  integer UTF-16 boundaries and must not split a surrogate pair.
- Overlapping detections are resolved deterministically: lower `start` wins, and
  the longest detection wins when multiple detections share the same `start`.
  Omitted overlaps are reported with `overlapping_detection`.
- Built-in MVP categories are email, bearer token, API-key-like string, and URL.
- Custom detectors must be isolated so thrown errors cannot leak raw input.
- Detector failures must block content export rather than letting partially
  redacted content pass.

## Safety Requirements

- Avoid catastrophic backtracking on untrusted text.
- Enforce length and traversal limits before detectors process very large input.
- Add positive, negative, overlap, repeated-match, Unicode, and long-string
  fixtures for behavior changes.

## Review Blockers

- A detector emits original values in errors, warnings, reports, or telemetry.
- A detector default changes without fixture evidence and migration notes.
- A detector claim is described as complete sensitive-data discovery.
