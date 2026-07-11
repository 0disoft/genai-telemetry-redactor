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
- Detector context includes an `AbortSignal` and, when a detector timeout is
  configured, a `deadlineEpochMs` timestamp. Custom async detectors should stop
  promptly when the signal is aborted.
- Overlapping detections are resolved deterministically only when multiple
  detections share the same `start`; the longest detection wins and omitted
  same-start overlaps are reported with `overlapping_detection`. Partial overlaps
  from different starts fail closed with `overlapping_detection` because the
  redactor cannot prove that the non-overlapping suffix is safe to export.
- Built-in MVP categories are email, bearer or HTTP auth token, API-key-like
  strings including common cloud and source-control token shapes, and URL.
- Custom detectors must be isolated so thrown errors cannot leak raw input.
- Detector metadata inspection is isolated as well. A detector object, reason
  collection, or detector array that throws during validation fails closed with
  `invalid_redaction_options` without propagating the original exception.
- Custom detector reason codes must be safe category labels. Built-in reasons
  are fixed, and custom reasons must use a bounded `custom:<label>` form that
  does not include matched values, customer identifiers, URLs, tokens, or other
  raw input.
- Detector failures must block content export rather than letting partially
  redacted content pass.
- Detector timeouts and caller cancellation must block content export and return
  safe failure codes without echoing detector exception text or input content.
- `createRegexDetector(options)` is the preferred helper for regex-backed custom
  detectors. It clones caller regexes into global, non-sticky scanners, uses
  whole-match UTF-16 ranges by default, supports explicit submatch range mapping,
  ignores zero-length matches to avoid scanner loops, and creates a fresh scanner
  per detection call so shared regular-expression state cannot leak between
  reentrant calls.
- Regex-backed custom detectors must follow
  `docs/security/custom-regex-redos-guidance.md`. The redactor can bound input
  size and async detector duration, but it cannot preempt a synchronous
  JavaScript regex while the engine is evaluating a backtracking-heavy pattern.

## Reusable Profiles

`createRedactionProfile(config)` snapshots built-in selection, custom detector
references, limits, and replacement policy for reuse across core redaction
operations. Profile creation rejects an empty effective detector set, duplicate
detector IDs, invalid limits, and a `maxDetectors` value below the configured
detector count with `invalid_redaction_profile`.

Profile-backed operations accept only the profile and an optional operation-local
`AbortSignal`. They do not accept per-call detector, limit, or replacement
overrides. Profiles preserve existing overlap behavior and do not introduce
detector priority, first-match-wins, or automatic built-in suppression.

The profile snapshots detector arrays, detector IDs, declared reasons, and
detector function references. Replacing those caller-owned properties after
profile creation does not change the profile. Detector functions still execute
with their original detector object as `this`, so caller-owned closure and object
state used inside a function remains the caller's responsibility. Replacement
function state is likewise not deeply immutable.

## Safety Requirements

- Avoid catastrophic backtracking on untrusted text.
- Enforce length and traversal limits before detectors process very large input.
- Add positive, negative, overlap, repeated-match, Unicode, and long-string
  fixtures for behavior changes.

## Review Blockers

- A detector emits original values in errors, warnings, reports, or telemetry.
- A detector default changes without fixture evidence and migration notes.
- A detector claim is described as complete sensitive-data discovery.
- A profile-backed operation silently accepts a per-call policy override.
- Profile documentation claims that detector priority makes partial overlaps
  safe.
