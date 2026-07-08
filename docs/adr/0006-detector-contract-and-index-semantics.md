# Detector Contract and Index Semantics

Status: Accepted

## Context

Detectors need stable range semantics so replacement can be deterministic across
Unicode text, overlapping matches, and custom detector hooks.

## Decision

Detector ranges use JavaScript UTF-16 code unit offsets, matching `String.length`,
`RegExpExecArray.index`, and `String.prototype.slice`.

Valid ranges are half-open `[start, end)` ranges where `start` and `end` are
integer UTF-16 boundaries. A range must not split a surrogate pair. Invalid
ranges fail closed with `invalid_detection_range`.

When detections overlap, the redactor sorts by ascending `start`; detections
with the same `start` prefer the longest `end`. Later detections with the same
start are omitted and reported with `overlapping_detection`. Partial overlaps
from different starts fail closed with `overlapping_detection` because silently
omitting the later detection can leave its non-overlapping suffix unredacted.

Detector IDs and reason codes are public compatibility surface. Custom detector
failures fail closed and must not leak raw input through errors, warnings, or
reports.

## Consequences

- Built-in regex detectors can use native match indices directly.
- Custom detectors that operate on Unicode code points or grapheme clusters must
  convert their ranges to UTF-16 code unit offsets before returning detections.
- Tests must cover repeated matches, same-start overlap, different-start partial
  overlap, Unicode ranges, invalid ranges, and detector failure behavior.

## Review Blockers

- Detector ranges are undocumented.
- Custom detector failures allow content export to continue.
- Detector changes lack corpus evidence.
