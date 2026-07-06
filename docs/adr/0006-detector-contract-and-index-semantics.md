# Detector Contract and Index Semantics

Status: Proposed

## Context

Detectors need stable range semantics so replacement can be deterministic across
Unicode text, overlapping matches, and custom detector hooks.

## Proposed Direction

Define a detector contract before implementation. The contract must specify
range indexing, overlap resolution, reason-code stability, custom detector
failure handling, and fixture requirements.

The exact index semantic remains UNDECIDED until implementation chooses the
runtime string model and test corpus.

## Review Blockers

- Detector ranges are undocumented.
- Custom detector failures allow content export to continue.
- Detector changes lack corpus evidence.
