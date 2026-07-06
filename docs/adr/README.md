# Architecture Decisions

Status: Active

## Purpose

Architecture decisions define the durable boundaries for the GenAI telemetry
redaction library and SDK. They should keep the project focused on redacting
LLM prompt, completion, and tool argument content before telemetry export.

## Decision Index

- 0001: Initial architecture boundaries.
- 0002: Contract source of truth.
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
