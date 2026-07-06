# Runtime and Module Format

Status: Accepted

## Context

Runtime and module format affect package exports, tests, examples, and release
automation. The current repository has no implementation yet.

## Decision

Use a TypeScript-first package with a server-side JavaScript runtime target.
Implementation should target Node.js `>=22.14.0`, ESM-only exports, and pnpm
workspace layout.

The first implementation should keep build tooling minimal and avoid dual CJS
output unless consumer evidence justifies a later ADR.

## Review Blockers

- Runtime targets are changed without validation.
- Build tooling becomes an architecture decision accidentally.
- Core redaction depends on browser APIs, provider SDKs, or telemetry backends.
