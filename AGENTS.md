# AGENTS.md

## Repository Scope

Scope: backend library

This repository owns a GenAI telemetry redaction library and SDK surface. Its job is
to redact LLM prompt, completion, and tool-call content before telemetry export, then
emit safe metadata, redaction summaries, and OpenTelemetry GenAI-compatible mapping
helpers.

This repository does not own a hosted API server, database schema, telemetry backend,
model gateway, DLP platform, frontend routing, visual design, component hierarchy,
design tokens, or browser interaction policy.

Consumer-facing behavior is contracted through `docs/product/02-spec.md`,
`docs/library/public-api.md`, `docs/sdk/public-api.md`, `docs/backend/06-logging-and-observability.md`,
and `docs/engineering/04-security-baseline.md`.

## Repository Shape

Primary repository type: library
Addons: sdk

- library: This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.
- sdk: This repository type owns public API, compatibility, examples, versioning, and consumer migration.


## Source of Truth

- Product scope: docs/product/02-spec.md
- Redaction and telemetry boundary: docs/backend/06-logging-and-observability.md
- Public library API: docs/library/public-api.md
- Package boundary and detector policy: docs/library/package-boundaries.md,
  docs/library/detector-contract.md, docs/library/replacement-token-policy.md,
  docs/library/traversal-and-limits.md
- SDK integration contract: docs/sdk/public-api.md
- Adapter and OTel policies: docs/adapters/openai-compatible-shape.md,
  docs/adapters/anthropic-messages-shape.md, docs/otel/genai-mapping-policy.md
- Security baseline: docs/engineering/04-security-baseline.md
- Security and fixture policy: docs/security/redaction-failure-policy.md,
  docs/security/fixture-safety-policy.md
- Architecture decisions: docs/adr/*.md
- Validation: VALIDATION.md
- Initial core implementation: packages/core/src/index.ts
- Secret safety script: scripts/check-no-live-secrets.ts
- Agent routing: .agents/context-map.md
- Repository hygiene: .editorconfig, .gitattributes, .gitignore

## Hard Rules

- Do not generate hosted application, API server, database, gateway, frontend, or
  deployment source code from this repository.
- Keep library source changes inside documented package boundaries.
- Do not invent technology choices. Use UNDECIDED when a decision is not known.
- Do not create fake credentials, tokens, secrets, or private values.
- Do not rely on generated, cache, or build output as source truth.
- Do not promise complete PII or DLP coverage. The project can reduce telemetry leakage
  risk, but cannot guarantee perfect detection.
- Do not store raw prompts, completions, tool arguments, API keys, bearer tokens, or
  customer identifiers as examples, fixtures, logs, or documentation samples.

## Repository Hygiene

- .editorconfig sets line ending, encoding, and final newline policy.
- .gitattributes sets Git text normalization and binary diff policy.
- .gitignore excludes local, secret, build, and cache artifacts.
- Generated, cache, and build output must not be used as design-document evidence.
- Do not create large diffs that only change line endings.

## Before Editing

- Read this file, VALIDATION.md, CHECKLIST.md, and .agents/context-map.md.
- Read the skill and checklist named by the context map.
- Confirm source-of-truth documents before changing contracts.

## Out of Scope

- Application source scaffolding.
- Runtime infrastructure such as Docker, Kubernetes, Terraform, or framework apps.
- Project-specific credentials or deployment secrets.
- Hosted telemetry collection, prompt storage, model routing, legal compliance
  certification, or provider account configuration.

## Final Response Requirements

- List executed validations, passed validations, skipped validations, skip reasons, and remaining risk.
- Name any source-of-truth documents changed.
- Call out API, DB, repository hygiene, and runner changes explicitly.
