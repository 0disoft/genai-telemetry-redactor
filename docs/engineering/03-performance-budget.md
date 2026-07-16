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

`pnpm run performance` uses synthetic data and intentionally broad CI ceilings.
It is a catastrophic-regression gate, not a hardware benchmark:

- 16 KiB text redaction: median at most 30 ms and p95 at most 100 ms.
- 100-item nested tool arguments: median at most 120 ms and p95 at most 350 ms.

The checked-in baseline owns iteration counts and thresholds. Tightening a limit
requires repeatable CI evidence; loosening one requires a reviewed reason. Security
and fail-closed behavior still take priority over passing the timing gate.

## Review Blockers

- A performance shortcut exports content before redaction.
- A detector can hang or backtrack badly on untrusted user text.
- A new dependency is added without necessity, license, and bundle/runtime
  impact review.
