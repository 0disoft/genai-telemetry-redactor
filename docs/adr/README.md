# Architecture Decisions

Status: Active

## Purpose

Architecture decisions define the durable boundaries for the GenAI telemetry
redaction library and SDK. They should keep the project focused on redacting
LLM prompt, completion, and tool argument content before telemetry export.

## Decision Index

- 0001: Initial architecture boundaries.
- 0002: Contract source of truth.
- 0003: Single repository package boundaries.
- 0004: Runtime and module format.
- 0005: Fail-closed content export.
- 0006: Detector contract and index semantics.
- 0007: Replacement token policy.
- 0008: Streaming content policy.
- 0009: OpenTelemetry GenAI mapping version policy.
- 0010: License and dependency policy.
- 0011: Public release and npm provenance.
- 0012: Remove hosted API and DB placeholders.
- 0013: Detector timing breakdown policy.
- 0014: Buffered stream redaction policy.
- 0015: Redaction profile composition policy.
- 0016: Anthropic Messages adapter boundary.
- 0017: Built-in whitespace-boundary streaming policy.
- 0000: Template for future decisions.

## Source of Truth

- Product scope: ../product/02-spec.md
- Public library API: ../library/public-api.md
- SDK integration contract: ../sdk/public-api.md
- Redaction and telemetry boundary: ../backend/06-logging-and-observability.md
- Security baseline: ../engineering/04-security-baseline.md
- Validation names: ../../VALIDATION.md

## Review Blockers

- A decision expands the project into a telemetry backend, model gateway,
  hosted API server, prompt store, or complete DLP platform.
- A decision allows raw prompts, completions, tool arguments, bearer tokens, API
  keys, or customer identifiers to be logged, stored, or used as examples.
- A decision claims complete PII, DLP, or compliance coverage.
- A decision weakens `capture_content: false` as the default safety posture.
