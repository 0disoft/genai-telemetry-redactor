# Release

Status: Active

## Operational Contract

Releases ship a package. They do not deploy a service. Versioning and migration
rules follow docs/library/semver.md and docs/library/migration-guide.md.

## Pre-Release Checklist

- test, docs, and check validations pass or skipped risk is explicit.
- Public API and SDK docs match package behavior.
- LICENSE is Apache-2.0 and package metadata reflects it before package release.
- SECURITY.md exists and public issue guidance forbids raw sensitive examples.
- Detector default changes have fixtures and migration notes.
- Examples use synthetic values only.
- `capture_content: false` remains the default.
- No release artifact includes raw GenAI content or live-looking secrets.
- Runtime, license, package name, and publishing requirements are reflected in
  ADRs before release workflow files are added.
- `pnpm run release-readiness` and the N-1/current consumer matrix pass before
  any npm staging attempt.
- The tag workflow stages the package but does not make it public. A maintainer
  reviews the staged artifact and approves it with npm 2FA. After the exact
  version is visible in the npm registry, the maintainer reruns the tag workflow
  so the public package is verified. Do not rerun while approval is pending.

## Published Release Evidence

- `v0.2.6` was published on 2026-07-13.
- npm package version: `genai-telemetry-redactor@0.2.6`.
- npm integrity:
  `sha512-EcHMW50Z2V95Y1blHZhU+y4MvCySBYC6qFJqLliqWM5Cua+uuBpfTlDeMDf4s5yUWGBZyKjThqKQo7GI1BZhaw==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.6.
- Release workflow: GitHub Actions `Release` run `29241875675` completed successfully on attempt 2
  after the exact published package became visible in the npm registry.
- `v0.2.5` was published on 2026-07-13.
- npm package version: `genai-telemetry-redactor@0.2.5`.
- npm integrity:
  `sha512-wumAulPxeZREsJHoRJY2+hHIv5KzLK9BFVWGnf2QSI56F7tuuK1uKL33ZD05+TDByyOYiZ82qd4WKfi1G1SJ5A==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.5.
- Release workflow: GitHub Actions `Release` run `29232216859` completed successfully for tag
  `v0.2.5`.
- `v0.2.4` was published on 2026-07-13.
- npm package version: `genai-telemetry-redactor@0.2.4`.
- npm integrity:
  `sha512-E6vk1uPZlXEM3nmkYC0mH5JTDRcPf/QIrjjO/JiQQzMs3XZw3b03nBeKX0gByw9ste5cD/d39L/qqxNP+XfvAg==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.4.
- Release workflow: GitHub Actions `Release` run `29230945906` completed successfully for tag
  `v0.2.4`.
- `v0.2.3` was published on 2026-07-13.
- npm package version: `genai-telemetry-redactor@0.2.3`.
- npm integrity:
  `sha512-EoA2tc/CucdfRSC8VvGyf27F1x8fHcn4ynbxTYoq2Lya2CBUN/Gs67WQpTFPihVLd6Z3aUhYRsniSR4JLT8n7A==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.3.
- Release workflow: GitHub Actions `Release` run `29224168991` completed successfully for tag
  `v0.2.3`.
- `v0.2.2` was published on 2026-07-12.
- npm package version: `genai-telemetry-redactor@0.2.2`.
- npm integrity:
  `sha512-DvmT8HruPIxueBZLAASTdDB/4zEz+wvLeQ+bBe6gy3hLSsdytl3QSUvstubPIt4wwk4PHci3OQPUH3f6/F4uMw==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.2.
- Release workflow: GitHub Actions `Release` run `29179750348` completed successfully for tag
  `v0.2.2`.
- `v0.2.1` was published on 2026-07-11.
- npm package version: `genai-telemetry-redactor@0.2.1`.
- npm integrity:
  `sha512-iKLasK6PeQ5yK0YgYPcppG097BNC48EMvsOGFn4EfiXBLoQkYZuoRJ87MyqW8epcTN4NdFaekkkv2W0B1yLc2w==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.1.
- Release workflow: GitHub Actions `Release` run `29152401966` completed successfully for tag
  `v0.2.1`.
- `v0.2.0` was published on 2026-07-11.
- npm package version: `genai-telemetry-redactor@0.2.0`.
- npm integrity:
  `sha512-UdKRgle+4GUcnB9rB3Uvf4RbRpAsN7AAa8TIAgOh9HhV/pDWJK4wAUH15DHL43zyHxA7IpoKF7/VFPfiIF/6fw==`.
- GitHub release: https://github.com/0disoft/genai-telemetry-redactor/releases/tag/v0.2.0.
- Release workflow: GitHub Actions `Release` run `29143977897` completed successfully for tag
  `v0.2.0`.

## Stop Conditions

- Unsafe content export by default.
- Redaction failure exports content.
- Detector default changes lack evidence.
- Package surface changes lack semver or migration notes.
- Publishing relies on long-lived credentials without an ADR-backed reason.
- A staged package has not received maintainer 2FA approval or the public
  registry artifact has not passed the rerun verification.
- `pnpm run release-readiness` reports unresolved blockers.
