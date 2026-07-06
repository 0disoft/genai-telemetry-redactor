# Performance Budget

Status: Active

## Contract

Performance matters because redaction sits in the hot path of LLM requests and
telemetry export. Security still wins over speed: unsafe fast paths are not
acceptable.

## Budget Areas

- Detector latency per prompt, completion, and tool argument payload.
- Payload size after redaction and metadata mapping.
- Memory overhead for nested tool arguments.
- Streaming buffer size when streaming support is implemented.
- Package size and dependency footprint for SDK consumers.

## Current Thresholds

Exact numeric thresholds are not chosen yet. Until implementation begins,
changes must document expected complexity and avoid dependencies that make the
redaction hot path unexpectedly heavy.

## Review Blockers

- A performance shortcut exports content before redaction.
- A detector can hang or backtrack badly on untrusted user text.
- A new dependency is added without necessity, license, and bundle/runtime
  impact review.
