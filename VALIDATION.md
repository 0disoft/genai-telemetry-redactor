# Validation

Status: Active

## Validation Source of Truth

This document owns stable validation names for the GenAI telemetry redaction
library and SDK scaffold.

## Standard Validation Names

- format
- lint
- typecheck
- test
- contract
- migration-check
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
- test: Vitest test suite.
- contract: live-looking secret guard across docs, packages, and scripts.
- docs: live-looking secret guard for documentation surfaces.
- smoke: focused core redaction smoke test.
- check: format, typecheck, test, contract, and docs.

## Hygiene Validation

Repository hygiene file changes must check line-ending churn, binary diff pollution,
tracked secret files, ignored build/cache artifacts, and generated-output drift.

## Scope

backend validation routes must stay stack-neutral unless a runner file explicitly defines a command.

## Repository Shape

library, sdk validation must stay repository-shape focused and must not imply generated application source code.
