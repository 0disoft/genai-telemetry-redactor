# Custom Regex ReDoS Guidance

Status: Active

## Contract

Custom regex detectors run on untrusted prompt, completion, and tool-argument
text. Detector authors must avoid patterns that can grow superlinearly on crafted
input. The library can reduce redaction workload with length, traversal, detector
count, and async detector timeout limits, but it cannot safely preempt a
synchronous JavaScript regular expression once the engine is already evaluating
it.

## Safer Pattern Style

- Prefer simple literal prefixes, bounded character classes, and explicit maximum
  lengths.
- Anchor patterns to a field name, protocol, delimiter, or clear boundary when
  the redaction target has one.
- Use non-capturing groups for structure and reserve capturing groups only for
  `toDetection(match)` subrange mapping.
- Keep alternation branches short and mutually distinct when possible.
- Test positive matches, negative matches, repeated matches, long non-matching
  strings, and overlap behavior with synthetic values only.

## Avoid

- Nested quantifiers such as repeated groups that also contain repeated
  wildcards.
- Broad `.*` or `.+` scans before a late delimiter on untrusted long strings.
- Backtracking-heavy optional groups around overlapping alternatives.
- Lookbehind-heavy or backreference-heavy patterns unless there is a measured
  reason and a small bounded input.
- Regex examples that look like live provider keys, bearer tokens, private URLs,
  customer text, or copied logs.

## Runtime Limits

- `maxStringLength` blocks a single oversized text value before detectors run.
- `maxTotalStringLength` blocks oversized JSON-like traversals across many string
  leaves.
- `maxDetectors` caps detector count for one text or object-key check.
- `maxDetectorRuns` caps cumulative detector execution during JSON-like
  traversal.
- `maxDetectorDurationMs` gives async detectors an abort signal and deadline, but
  synchronous regex evaluation cannot be interrupted mid-match.

These limits are guardrails, not proof that a custom regex is safe. A detector
that may run on attacker-controlled text should be reviewed as hot-path parsing
logic.

## Review Blockers

- A custom detector pattern can catastrophically backtrack on a bounded but
  realistic input size.
- Tests prove only successful matches and skip long non-matching strings.
- Documentation claims that detector timeouts can stop synchronous regex
  execution.
- Fixtures or examples include live-looking credentials or private content.
