# Risk Register

Status: Product-shaping
Owner: repository owner

## Purpose

This document tracks product risks that can turn a redaction helper into a false
safety claim or a telemetry leak.

## Source of Truth

- Product decision: the library reduces telemetry leakage risk but does not guarantee
  complete DLP.
- Technical owner: repository owner
- Related ADR: docs/adr/0001-initial-architecture-boundaries.md

## Required Decisions

- Boundary: detect, redact, summarize, and map telemetry metadata.
- Data ownership: caller owns raw content; library owns sanitized result contracts.
- Failure and recovery behavior: fail closed and report warnings.
- Validation needed before merge: VALIDATION.md

## Product Risks

- False negatives leak sensitive prompt, completion, tool argument, token, URL, or
  customer data into telemetry.
- False positives remove too much content and make operational debugging less useful.
- Streaming chunks split secrets across boundaries that single-message detectors miss.
- Provider payload shapes drift and bypass adapter coverage.
- Redaction summaries reveal too much context about the original value.
- Documentation overstates privacy, compliance, or DLP guarantees.
- Examples or fixtures accidentally include real secrets or private identifiers.

## Review Blockers

- Detector changes lack positive and negative corpus coverage.
- Streaming or nested tool-call handling lacks fixtures.
- Logging, telemetry, examples, or tests include raw sensitive values.
- A release note claims safety beyond the tested detector and adapter surface.
