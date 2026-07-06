# Config and Environment

Status: Active

## Operational Contract

The package should expose explicit options rather than relying on hidden
environment state. Consumer applications own provider credentials, exporters,
sampling, and deployment environment.

## Defaults

- `capture_content` defaults to false.
- Detectors should be explicit and documented.
- Custom detector hooks should be caller-provided.
- OpenTelemetry exporter configuration is out of scope.

## Validation

- Required validation names: test, docs, check.
- Release blocker status: defaults that export content, require secrets, or
  depend on hidden environment state block release.
- Remaining operational risk: consumers can still configure their telemetry
  stack unsafely outside this package.
