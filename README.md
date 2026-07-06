# GenAI Telemetry Redactor

Status: Product-shaping
Scope: backend
Repository Type: library
Addons: sdk

GenAI Telemetry Redactor is a library and SDK surface for redacting sensitive content
from LLM telemetry before it reaches logs, spans, events, or observability backends.

The project focuses on prompt, completion, and tool-argument boundaries. It keeps
content capture off by default, maps safe metadata to OpenTelemetry GenAI conventions,
and reports redaction counts and reasons without preserving raw user content.

## Source Files

- AGENTS.md: agent working rules
- CHECKLIST.md: checklist router
- VALIDATION.md: validation names and reporting requirements
- .agents/context-map.md: agent route map
- docs/: design, operations, architecture, and engineering standards
- docs/product/02-spec.md: durable product contract
- docs/library/public-api.md: public library API boundary
- docs/sdk/public-api.md: SDK integration boundary
- docs/backend/06-logging-and-observability.md: telemetry mapping and content-capture policy
- docs/engineering/04-security-baseline.md: security and redaction safety baseline

## Repository Shape Notes

- library: This repository type owns public API surface, package compatibility, semantic versioning, migration guidance, distribution artifacts, and consumer-facing deprecation policy.
- sdk: This repository type owns public API, compatibility, examples, versioning, and consumer migration.

## MVP Boundary

The first useful version should support OpenAI-compatible request and response shapes,
nested tool arguments, a small detector set, replacement-token policy, and safe
OpenTelemetry GenAI metadata mapping.

The MVP must not become a telemetry backend, model gateway, prompt store, legal
compliance product, or full DLP platform.

## Repository Hygiene

.editorconfig, .gitattributes, and .gitignore are generated to keep line endings,
binary diffs, local files, build outputs, caches, and secret files under control.

## Scope Notes

Runtime packaging, exported module format, and exact OpenTelemetry semantic-convention
version remain UNDECIDED until implementation starts. The product boundary is already
decided: redact before export, capture content only by explicit opt-in, and never treat
redaction as perfect sensitive-data discovery.
