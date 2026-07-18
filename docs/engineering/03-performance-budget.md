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
- 16 KiB built-in rolling stream redaction in 512-code-unit input chunks:
  median at most 100 ms and p95 at most 300 ms.

The checked-in baseline owns iteration counts and thresholds. Tightening a limit
requires repeatable CI evidence; loosening one requires a reviewed reason. Security
and fail-closed behavior still take priority over passing the timing gate.

Rolling-stream thresholds include repeated detector execution and output
assembly across whitespace flushes. They are deliberately broad catastrophic
regression limits, not a promise of time-to-first-token on every payload. A long
whitespace-free URL or token is intentionally retained until a delimiter or the
configured buffer failure boundary.

## Trend Evidence

CI runs the benchmark once more after the repository gate and retains one JSON
artifact per Node.js matrix entry for 30 days. Each artifact contains only timing
results, generation time, commit SHA, workflow run identifiers, Node.js version,
platform, and architecture. It never contains benchmark input, prompts,
completions, tool arguments, or redacted output.

Generate the same shape locally when investigating a regression:

```text
pnpm run performance -- --output artifacts/performance-local.json
```

Results from different runner classes are evidence for review, not an automatic
replacement for `scripts/performance-baseline.json`. Baseline changes still
require repeatable evidence from a comparable environment and explicit review.

## Review Blockers

- A performance shortcut exports content before redaction.
- A detector can hang or backtrack badly on untrusted user text.
- A new dependency is added without necessity, license, and bundle/runtime
  impact review.
