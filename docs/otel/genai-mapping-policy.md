# OpenTelemetry GenAI Mapping Policy

Status: Active

## Contract

OpenTelemetry mapping receives safe metadata and redaction summaries. It must not
receive raw prompts, completions, tool arguments, credentials, private URLs, or
customer identifiers.

## Mapping Rules

- Treat the upstream OpenTelemetry GenAI semantic conventions as Development until
  the upstream project marks them stable.
- Pin the default mapping provenance to an audited upstream commit. Do not label
  moving `main` as a reproducible mapping version.
- Run the scheduled drift detector as an advisory freshness check. When upstream
  `main` differs from the pin, it opens, refreshes, or reopens one review issue
  with exact commit and comparison links. When the pin catches up, it closes the
  stale issue. Every run writes the compared commits and status to the job summary.
- Do not automatically update the pin or generate a pull request. A maintainer must
  review mapped attributes, conformance fixtures, migration notes, and version
  impact before adopting an upstream change.
- Use official `gen_ai.*` attributes only for fields present in the upstream GenAI
  semantic conventions.
- Put library-specific redaction and content-capture fields under
  `genai_redactor.*` so custom fields do not look like standard OpenTelemetry
  attributes.
- Separate pure metadata-object mapping from optional span-writer helpers.
- Treat token usage, model, operation, latency, error class, redaction status,
  counts-by-reason, and numeric redaction timings as safe candidate fields. Token
  counts mapped to official attributes must be non-negative safe integers.

## Implemented Mapper

- `mapRedactionReportToGenAIMetadata(report, options)` is a pure object mapper. It
  does not import OpenTelemetry SDK packages, write spans, write events, or export
  telemetry.
- The mapper accepts `RedactionReport` plus safe metadata candidates only. It does
  not accept provider requests, provider responses, prompts, completions, tool
  arguments, credentials, private URLs, customer identifiers, span objects, or
  exporter objects.
- The mapper uses official GenAI attributes for `gen_ai.operation.name`,
  `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`,
  `gen_ai.usage.input_tokens`, and `gen_ai.usage.output_tokens`.
- `providerName` identifies the provider that served the request. Adapter-shape
  labels such as `openai-compatible` are not provider names; callers should use
  the upstream well-known provider value when one applies.
- OpenTelemetry GenAI does not define `gen_ai.usage.total_tokens` in the pinned
  snapshot. The optional caller-provided total is emitted as the library extension
  `genai_redactor.usage.total_tokens`.
- The mapper uses `genai_redactor.*` attributes for redaction status, redaction
  counts, warning codes, content-capture disabled state, mapper semconv source,
  mapper semconv status, latency, redaction duration, detector duration, and
  detector run count.
- Detector-level timing breakdowns are not exported. Aggregate detector duration
  and detector run count are the default telemetry boundary.
- Warning `path` and `detectorId` fields are not exported by default.
- Redaction status and warning codes use closed allowlists at the mapper
  boundary. Unknown runtime values are dropped rather than copied into telemetry
  attributes.
- The mapper records `opentelemetry-semconv-genai-150760c6252a`, the full
  upstream commit URL, and `development` as semconv metadata. This is not a
  stability claim.
- The `150760c6252a` adoption reviewed three upstream commits after
  `c26a2c21d1ee`. They changed only dependency manifests and lockfiles under
  reference scenarios. None changed semantic-convention definitions or the six
  official attributes emitted by this mapper, so the mapped attribute inventory
  remains unchanged.
- The package emits metadata objects only. It does not write spans or events, so
  upstream Span Event API migration is outside this mapper's ownership boundary.
- If report or metadata option inspection throws, the mapper returns a minimal
  metadata-only failure with content capture disabled and records `mapperInput`
  as dropped. Original exception text and caller input are not propagated.

## Review Blockers

- Mapper APIs accept raw provider payloads.
- Mapping changes lack version notes.
- Redaction reports include original values, reversible encodings, or sensitive
  field paths by default.
