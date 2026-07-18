# Validation

Status: Active

## Validation Source of Truth

This document owns stable validation names for the GenAI telemetry redaction
library and SDK scaffold.

## Standard Validation Names

- format
- lint
- typecheck
- build
- test
- contract
- release-readiness
- migration-check
- compatibility
- otel-semconv-drift
- performance
- smoke
- docs
- check

## Required Final Report

Final responses must list executed validations, passed validations, skipped validations, skip reasons, and remaining risk.

## Runner Policy

Task runner files are optional. Runner `none` means no executable task runner is generated.
If a runner is generated, runner command names must match this document.
Unconfigured runner commands must fail, not pass with a fake success.

## Configured Runner Commands

- format: Prettier check for package, TypeScript, and runner files.
- lint: TypeScript no-emit check.
- typecheck: TypeScript no-emit check.
- build: TypeScript emit to ignored `dist/` for package artifact validation.
- test: Vitest test suite.
- contract: live-looking secret guard across docs, packages, and scripts plus
  package export-surface, public API documentation, dry-run artifact, and packed
  consumer import and executable example guards.
- compatibility: packs the current package and runs the same ESM runtime and
  TypeScript declaration fixture against the pinned N-1 npm release and current
  tarball.
- release-readiness: npm staged-publish blocker check for package metadata,
  required release files, publishing policy, and trusted publishing workflow
  readiness.
- otel-semconv-drift: compare the pinned OpenTelemetry GenAI semantic-convention
  commit with upstream `main`. This validation requires network access and reports
  drift without changing the pin.
- performance: run bounded synthetic 16 KiB text and 100-item nested tool-argument
  benchmarks and fail on coarse median or p95 regression ceilings. An optional
  `--output artifacts/<file>.json` argument writes bounded trend evidence without
  payload content.
- docs: live-looking secret guard for documentation surfaces.
- smoke: focused core text, JSON-like redaction, buffered and built-in rolling
  streams, reusable profile, provider adapters, OTel metadata mapper, and SDK
  wrapper smoke tests.
- check: format, typecheck, test, contract, and docs.

## Hygiene Validation

Repository hygiene file changes must check line-ending churn, binary diff pollution,
tracked secret files, ignored build/cache artifacts, and generated-output drift.

## Scope

backend validation routes must stay stack-neutral unless a runner file explicitly defines a command.

## Repository Shape

library, sdk validation must stay repository-shape focused and must not imply generated application source code.
