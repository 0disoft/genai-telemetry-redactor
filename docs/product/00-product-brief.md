# Product Brief

Status: Product-shaping
Owner: repository owner

## Purpose

GenAI Telemetry Redactor helps teams observe LLM applications without accidentally
shipping raw prompts, completions, tool arguments, bearer tokens, API keys, customer
text, or internal URLs into telemetry systems.

The product is a small library/SDK layer, not a hosted service. It is intended to sit
inside AI gateways, agent runtimes, backend SDK wrappers, and OpenTelemetry
instrumentation code.

## Source of Truth

- Product decision: redact GenAI content before telemetry export and keep content
  capture disabled by default.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Boundary: in-process redaction and metadata mapping for prompt, completion, and tool
  arguments.
- Data ownership: callers own raw content; this library owns sanitized outputs and
  redaction summaries only.
- Failure and recovery behavior: fail closed for content export and return explicit
  warnings or errors instead of passing raw content through.
- Validation needed before merge: VALIDATION.md

## Review Blockers

- A change enables raw content capture by default.
- A change claims complete DLP, legal compliance, or guaranteed PII detection.
- A change logs or stores unredacted prompt, completion, tool argument, token, URL, or
  customer identifier samples.
- A change adds provider-specific behavior without fixtures for nested and streaming
  payloads.
