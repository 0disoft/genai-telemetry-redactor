# Product Specification

Status: Product-shaping
Owner: repository owner

## Purpose

GenAI Telemetry Redactor provides a TypeScript-oriented library/SDK contract for
redacting LLM telemetry content before export.

The first product slice targets OpenAI-compatible request/response shapes and
Anthropic Messages request/response shapes, completion text, prompt messages,
nested tool-call arguments and results, redaction summary output, and
OpenTelemetry GenAI metadata mapping. Streaming content redaction remains a
safety area that must default to metadata-only export until chunk handling is
proven.

## Source of Truth

- Product decision: content capture is off by default; opt-in content export must pass
  through redaction first.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Boundary: library functions and SDK middleware for redaction, detector policy,
  replacement tokens, redaction reports, and telemetry metadata mapping.
- Data ownership: raw GenAI payloads stay with the caller; the library must not persist
  raw payloads.
- Failure and recovery behavior: unknown or failed redaction paths must suppress content
  export and preserve metadata-only telemetry where safe.
- Validation needed before merge: VALIDATION.md

## MVP Requirements

- Redact prompt messages, completion text, and tool arguments.
- Redact Anthropic top-level system prompts, text blocks, tool-use inputs, and
  tool-result content.
- Detect common email addresses, bearer tokens, API-key-like strings, and internal or
  absolute URLs.
- Allow custom detector hooks with reason codes.
- Emit replacement tokens that preserve detector category without preserving value.
- Produce redaction counts and reason summaries.
- Map safe GenAI metadata to OpenTelemetry span/event helpers.
- Keep `capture_content` false by default.

## Explicit Non-Goals

- Complete DLP or PII coverage.
- Telemetry backend, prompt storage, model gateway, or provider account management.
- Legal compliance certification.
- Provider shapes beyond the explicitly documented OpenAI-compatible and
  Anthropic Messages adapters.

## Review Blockers

- Raw content capture becomes default behavior.
- Redaction failure lets raw prompt, completion, or tool arguments pass through.
- Telemetry examples include real secrets, tokens, customer data, or private URLs.
- Compatibility or safety claims lack detector fixtures and failure-path evidence.
