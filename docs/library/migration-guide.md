# Migration Guide

Status: Product-shaping
Repository Type: library

## Repository Type Contract

This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.

## Source of Truth

- Product decision: migrations must explain redaction behavior changes before API
  changes.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Public API ownership: exported redaction and mapping contracts.
- Semantic versioning policy: public output and default detector changes require
  migration notes.
- Runtime and platform compatibility: document runtime floor changes when introduced.
- Package artifact and export surface: document import path and export changes.
- Deprecation and migration policy: include before/after examples with fake sample
  secrets only.

## Review Blockers

- Public exports change without semver and migration notes.
- Compatibility claims lack runtime or consumer evidence.
- Package artifacts drift from documented public API.
- Migration examples contain realistic live-looking credentials or private identifiers.

## 0.1.7

`RedactionReport` can now include a `timings` object with safe numeric summaries:
`durationMs`, `detectorDurationMs`, and `detectorRuns`. The OpenTelemetry mapper
exports these under `genai_redactor.redaction.*` attributes. These fields do not
include raw content, matched values, field paths, or detector IDs.

JSON-like traversal now reuses the first redacted clone for repeated references
to the same object. This avoids double-counting descendant redactions and avoids
spending detector budget twice on the same shared object. Circular references
still fail closed with `circular_reference`.

CI now validates Node.js `22.14.0` and `24.x`.

## 0.1.6

`maxDetectorRuns` is now reserved for cumulative detector executions during
JSON-like traversal. It is no longer interpreted by `redactText` as a detector
count limit. Use `maxDetectors` when callers need to cap how many detectors can
run for one text value or object-key safety check.

Partial overlaps from different detector starts now fail closed with
`overlapping_detection`. Same-start overlaps still keep the longest range and
report omitted shorter ranges as warnings.

The SDK now preserves successful redaction results when `onReport` throws and
adds a `report_callback_failed` warning. Built-in token detection and the
repository secret scanner also cover more common cloud, source-control, Google,
Slack, and HTTP auth token shapes without requiring live-looking fixtures.

## 0.1.4

`createRegexDetector(options)` is now a public helper for regex-backed custom
detectors. Callers can provide an `id`, custom `reason`, and `pattern` without
manually calculating whole-match ranges. Callers that need to redact only a
capturing group can pass `toDetection(match)` and return explicit UTF-16 code
unit ranges.

Regex-backed detectors should still use synthetic fixtures and avoid patterns
with catastrophic backtracking on untrusted prompt, completion, or tool-argument
text.

## 0.1.3

Custom detector ranges are now explicitly validated as JavaScript UTF-16 code
unit ranges. Valid ranges are half-open `[start, end)` offsets and must not
split a surrogate pair. A detector that returns a range inside a surrogate pair
now fails closed with `invalid_detection_range` instead of producing a malformed
redacted string.

Custom detectors that calculate offsets by Unicode code point, grapheme cluster,
or byte position should convert those offsets to UTF-16 code unit indices before
returning detections.
