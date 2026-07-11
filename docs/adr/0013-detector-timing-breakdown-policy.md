# Detector Timing Breakdown Policy

Status: Accepted

## Context

`RedactionReport.timings` exposes aggregate operation duration, aggregate
detector duration, detector run count, and safe numeric resource usage.
Operators may want more detail when a custom detector is slow, but detector
identifiers, detector names, and custom reason labels can reveal internal policy,
vendor choices, business-domain terms, or user-derived naming conventions.

OpenTelemetry attributes are often broadly queryable and retained longer than
application logs. A detector-level timing shape that looks harmless during local
debugging can become sensitive telemetry when exported by default.

## Decision

Do not expose detector-level timing breakdowns in the public report shape or the
default OpenTelemetry mapper.

The public report remains limited to aggregate numeric timing fields:

- `durationMs`
- `detectorDurationMs`
- `detectorRuns`
- `nodesVisited`
- `stringCodeUnits`

The OpenTelemetry mapper may export aggregate redaction duration, aggregate
detector duration, and detector run count under `genai_redactor.*`. Resource
usage counters remain report-only by default and support cumulative adapter
limits. Neither surface may export detector IDs, detector names, detector reason
labels, object paths, matched values, raw values, or per-detector timing series.

A future diagnostic feature may revisit this boundary only if it is explicitly
opt-in, local-first, bounded, and documented separately from default telemetry.
Any future breakdown must use stable safe buckets such as `built_in` and
`custom`, or another reviewed category shape, instead of caller-provided detector
identifiers or custom reason labels.

## Consequences

- Security impact: default telemetry avoids leaking detector policy names or
  caller naming conventions.
- Compatibility impact: `nodesVisited` and `stringCodeUnits` are additive
  optional fields in `0.2.1`.
- False-negative or false-positive impact: none; detection behavior is
  unchanged.
- Telemetry semantics impact: dashboards can observe aggregate redaction cost,
  but cannot rank individual detectors from exported telemetry.
- Migration impact: consumers that copy timing objects should tolerate the new
  optional numeric keys.

## Source of Truth

- Product scope: `docs/product/02-spec.md`
- Public API: `docs/library/public-api.md`
- SDK contract: `docs/sdk/public-api.md`
- OpenTelemetry mapping: `docs/otel/genai-mapping-policy.md`
- Validation evidence: `VALIDATION.md`

## Review Blockers

- A public report field exports detector IDs, detector names, custom reason
  labels, object paths, matched values, raw values, or per-detector timing
  series by default.
- A mapper attribute exposes detector-level timing under `gen_ai.*` or
  `genai_redactor.*`.
- A diagnostic timing feature is added without explicit opt-in and migration
  notes.
- Documentation presents aggregate timing as proof of complete performance or
  security coverage.
