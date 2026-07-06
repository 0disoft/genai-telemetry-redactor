# Diagrams

Status: Active

## Purpose

Diagrams should explain redaction and telemetry boundaries, not invent runtime
infrastructure. Prefer simple flows that show caller code, redaction policy,
detectors, safe metadata mapping, and the external telemetry exporter.

## Diagram Topics

- Non-streaming redaction before telemetry export.
- `capture_content: false` default path.
- Opt-in content capture with detector and replacement policy.
- Tool argument redaction for nested objects.
- Streaming content risk and safe metadata-only fallback.
- OpenTelemetry GenAI metadata mapping.

## Review Blockers

- A diagram shows this repository as owning a telemetry backend, database,
  hosted API server, prompt store, or model gateway.
- A diagram includes realistic secrets, private URLs, prompts, completions, or
  customer identifiers.
- A diagram implies complete DLP or compliance guarantees.
