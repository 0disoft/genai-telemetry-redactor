# Threat Model

Status: Active

## Contract

The main threat is telemetry leakage: application teams add GenAI observability
and accidentally export user content, credentials, API keys, bearer tokens,
internal URLs, or tool arguments to logs, traces, events, examples, or fixtures.

## Threats

- False negatives allow sensitive content to reach telemetry.
- False positives remove too much context and make debugging less useful.
- Provider shape drift leaves new content fields unredacted.
- Streaming chunk boundaries split a sensitive value across chunks.
- Errors or debug logs include raw content before redaction.
- Examples teach consumers to log raw prompt or completion bodies.
- Report field paths reveal customer business domain even after values are redacted.

## Controls

- `capture_content: false` by default.
- Redaction before telemetry export.
- Fail-closed content export on redaction failure.
- Fixture-backed detector corpus and custom detector hooks.
- Safe replacement tokens and reason summaries instead of raw values.
- Documentation warnings against complete DLP, PII, or compliance claims.

## Review Blockers

- Any path emits raw content before redaction.
- Any claim treats this package as full DLP or legal compliance automation.
- Streaming support ships without chunk-boundary test evidence.
- Provider support expands without shape-specific tests.
- Telemetry summaries export field paths by default.
