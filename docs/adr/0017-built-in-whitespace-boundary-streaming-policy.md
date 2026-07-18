# Built-in Whitespace-Boundary Streaming Policy

Status: Accepted

## Context

The final-flush helper proves safety for arbitrary configured detectors but adds
the full generation duration to content availability. A fixed trailing holdback
window does not solve this generally: built-in email, bearer-token, API-key, and
URL matches can grow without a finite maximum, and custom detectors expose no
machine-checkable match-width or finality contract.

Independent chunk redaction and an arbitrary `N`-code-unit holdback can therefore
release the beginning of a value before a later chunk proves that the complete
value is sensitive.

## Decision

Add `createBuiltInRollingTextStreamRedactor(options)` as an explicit core-only
helper with these limits:

- Only the reviewed built-in detectors are accepted. Custom detectors,
  reusable profiles, and an empty built-in selection fail closed with
  `invalid_redaction_options`.
- Content is flushed only through a whitespace boundary that no email, API-key,
  or URL built-in can cross.
- A trailing `Bearer`, `Token`, or `Basic` scheme plus whitespace is retained
  with the next token because the bearer detector needs that context.
- A whitespace-free segment remains buffered. If it exceeds
  `maxStreamBufferLength`, the helper clears the retained content and fails with
  `max_stream_buffer_length_exceeded`.
- `maxTotalStringLength`, `maxTotalDetections`, `maxDetectorRuns`, and
  `maxTotalDurationMs` are cumulative across flushes instead of restarting for
  each returned chunk.
- `push()` and `close()` are async and require one awaited operation at a time.
  Overlap clears retained content, invalidates the in-flight result, and fails
  with `stream_operation_in_progress`.
- `close()` redacts the final retained segment. No raw fallback is returned on
  detector, replacement, limit, cancellation, or lifecycle failure.

The helper is not wired into provider streaming adapters or the SDK. Those
surfaces remain metadata-only until provider event ordering, cancellation, and
content-block fixtures are separately reviewed.

## Why Whitespace Instead Of A Fixed Holdback

Whitespace is a proven delimiter for the four current built-in match grammars,
except for the explicit bearer-scheme context retained above. A fixed number is
not a proof because a URL, email component, or token can be longer than that
number. This policy trades latency on long whitespace-free segments for a
boundary the implementation can actually defend.

## Consequences

- Ordinary prose can be returned after completed whitespace-delimited segments.
- Long URLs, tokens, and other whitespace-free text remain buffered and may hit
  the buffer limit rather than being emitted early.
- Custom detector users continue to use
  `createBufferedTextStreamRedactor` and final flush.
- The rolling helper owns only its retained suffix. A successful flush severs
  that prefix from the stream object; close or terminal failure clears the
  suffix.
- Split fixtures cover every UTF-16 chunk boundary for each built-in category,
  bearer scheme retention, cumulative budgets, buffer overflow, concurrent
  misuse, and terminal lifecycle behavior.

## Source of Truth

- Public API: `docs/library/public-api.md`
- Detector contract: `docs/library/detector-contract.md`
- Streaming risk: `docs/testing/streaming-risk.md`
- Tests: `packages/core/test/rolling-stream-redactor.test.ts`
- Performance gate: `scripts/performance-baseline.json`

## Review Blockers

- A fixed holdback length is described as safe for unbounded detectors.
- Custom detectors or profiles enter the rolling helper without a new proven
  boundary contract.
- A bearer scheme is flushed before its following token can be inspected.
- Overlapping async operations can release either operation's content.
- Provider adapters or SDK wrappers export rolling content without their own
  shape and cancellation review.
