# Architecture

Status: Product-shaping

## Boundary

This repository owns the in-process boundary between GenAI calls and telemetry export.
It consumes model-provider request/response objects, tool-call payloads, redaction
policies, detector hooks, and optional OpenTelemetry span/event writers.

It emits sanitized metadata, replacement content when capture is explicitly enabled,
redaction summaries, and structured failure results. It must not own model routing,
telemetry storage, provider credentials, customer data storage, or legal compliance
claims.

## Runtime Flow

1. Caller passes an LLM request, response, streamed chunk, or tool-call argument through
   the redaction wrapper.
2. The wrapper applies built-in detectors and caller-provided detector hooks.
3. Matching values are replaced with stable redaction tokens such as
   `[REDACTED:api_key]` or `[REDACTED:url]`.
4. The mapper emits OpenTelemetry GenAI metadata with content capture disabled unless
   the caller explicitly opts in.
5. The result includes redaction counts, detector reason summaries, and warnings when
   a payload shape is only partially understood.
6. If redaction fails, the safe default is to skip content export rather than pass raw
   prompt, completion, or tool arguments through telemetry.

## Quality Attributes

- Security: content capture is off by default, raw content is never logged by the
  library, and detector failures fail closed for content export.
- Maintainability: provider-specific adapters must sit behind a stable core redaction
  pipeline so new provider shapes do not rewrite detector policy.
- Compatibility: public exports, replacement-token semantics, and metadata fields must
  follow semver and migration guidance.
- Observability: redaction summaries must be useful without leaking the values that
  triggered them.
- Honesty: documentation must state that this is not complete DLP and cannot guarantee
  detection of every sensitive value.
