# Initial Architecture Boundaries

Status: Accepted

## Context

GenAI observability needs model, token, latency, error, and tool-call telemetry,
but prompt, completion, and tool argument bodies often contain user content or
secrets. The project exists to keep useful OpenTelemetry GenAI metadata while
reducing the chance that raw sensitive content reaches a telemetry exporter.

## Decision

This repository owns a library and SDK middleware surface, not a hosted service.
The core runtime boundary is:

1. Accept OpenAI-compatible request, response, tool-call, or streaming event
   shapes from a caller-owned integration.
2. Detect sensitive text in prompt, completion, and tool argument fields.
3. Replace detected values with stable replacement tokens.
4. Emit redaction counts, reason summaries, and safe OpenTelemetry GenAI
   metadata.
5. Keep content capture disabled by default.

## Owned Surface

- Detector contracts for email, bearer token, API-key-like string, URL, and
  custom detectors.
- Replacement token policy.
- Redaction result shape and reason summary.
- OpenTelemetry GenAI metadata mapping helpers.
- SDK wrapper and middleware integration guidance.
- Fixture-driven safety tests for redaction behavior.

## Out of Scope

- Complete DLP or PII detection guarantees.
- Legal compliance certification.
- Prompt storage or telemetry storage.
- Hosted API server, database, worker fleet, or model gateway.
- All provider SDKs in the initial release.

## Failure Behavior

If content capture is disabled, raw content must not be exported. If content
capture is enabled and redaction fails, the package must fail closed for content
export and may emit only safe error metadata.

## Review Blockers

- Raw prompt, completion, tool argument, token, or private URL values appear in
  logs, spans, fixtures, examples, docs, or error messages.
- The library exports content by default.
- A change presents detector output as complete DLP or compliance evidence.
- A change treats parked placeholder API or DB files as active product contracts.
