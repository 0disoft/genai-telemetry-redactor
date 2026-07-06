# HTTP API Policy

Status: Active

## Boundary

This repository does not currently publish an HTTP API. The OpenAPI file is a
placeholder that documents this non-service boundary.

## Library Equivalent

The active public contract is the package API:

- redaction policy configuration;
- detector registration;
- redaction result shape;
- OpenTelemetry GenAI mapping helpers;
- SDK wrapper and middleware entry points.

## Merge Blockers

- A change documents routes, handlers, auth, or persistence as implemented
  without a new product decision.
- OpenAPI examples become the source of truth for package behavior.
- HTTP-style examples contain raw GenAI content or realistic secrets.
