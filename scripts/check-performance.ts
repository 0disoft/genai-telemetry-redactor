import { readFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { redactJsonLike } from "../packages/core/src/redact-json-like.js";
import { redactText } from "../packages/core/src/redact-text.js";

const ROOT = process.cwd();
const BASELINE_SCHEMA = "genai-telemetry-redactor/performance-baseline/v1";

type CaseBudget = {
  iterations?: number;
  maxMedianMs?: number;
  maxP95Ms?: number;
};

type PerformanceBaseline = {
  schemaVersion?: string;
  cases?: Record<string, CaseBudget>;
};

export type PerformanceCaseResult = {
  iterations: number;
  medianMs: number;
  p95Ms: number;
  maxMs: number;
};

export function percentile(values: readonly number[], percent: number): number {
  if (values.length === 0) {
    throw new Error("percentile requires at least one sample");
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error("percentile must be between 0 and 100");
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percent / 100) * sorted.length) - 1);
  const value = sorted[index];
  if (value === undefined) {
    throw new Error("percentile sample index was out of bounds");
  }
  return value;
}

export function evaluatePerformanceResults(
  baseline: PerformanceBaseline,
  results: Readonly<Record<string, PerformanceCaseResult>>,
): string[] {
  const violations: string[] = [];
  for (const [caseName, budget] of Object.entries(baseline.cases ?? {})) {
    const result = results[caseName];
    if (!result) {
      violations.push(`performance case did not run: ${caseName}`);
      continue;
    }
    if (
      typeof budget.maxMedianMs !== "number" ||
      typeof budget.maxP95Ms !== "number"
    ) {
      violations.push(`performance budget is incomplete: ${caseName}`);
      continue;
    }
    if (result.medianMs > budget.maxMedianMs) {
      violations.push(
        `${caseName} median ${result.medianMs}ms exceeded ${budget.maxMedianMs}ms`,
      );
    }
    if (result.p95Ms > budget.maxP95Ms) {
      violations.push(
        `${caseName} p95 ${result.p95Ms}ms exceeded ${budget.maxP95Ms}ms`,
      );
    }
  }
  return violations;
}

async function runPerformanceCheck(): Promise<void> {
  const baseline = JSON.parse(
    await readFile(
      path.join(ROOT, "scripts", "performance-baseline.json"),
      "utf8",
    ),
  ) as PerformanceBaseline;
  validateBaseline(baseline);

  const results: Record<string, PerformanceCaseResult> = {};
  for (const [caseName, budget] of Object.entries(baseline.cases ?? {})) {
    const iterations = requiredPositiveInteger(
      budget.iterations,
      `${caseName}.iterations`,
    );
    const operation = benchmarkOperation(caseName);
    for (let warmup = 0; warmup < 3; warmup += 1) {
      await operation();
    }

    const samples: number[] = [];
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      samples.push(await operation());
    }
    results[caseName] = {
      iterations,
      medianMs: roundMilliseconds(percentile(samples, 50)),
      p95Ms: roundMilliseconds(percentile(samples, 95)),
      maxMs: roundMilliseconds(Math.max(...samples)),
    };
  }

  const violations = evaluatePerformanceResults(baseline, results);
  process.stdout.write(
    `${JSON.stringify({ schemaVersion: BASELINE_SCHEMA, cases: results }, null, 2)}\n`,
  );
  if (violations.length > 0) {
    for (const violation of violations) {
      process.stderr.write(`Performance check: ${violation}\n`);
    }
    process.exitCode = 1;
  }
}

function benchmarkOperation(caseName: string): () => Promise<number> {
  switch (caseName) {
    case "text_16k": {
      const chunk =
        "contact user@example.invalid through https://service.example.invalid/path for synthetic telemetry ";
      const input = chunk
        .repeat(Math.ceil(16_384 / chunk.length))
        .slice(0, 16_384);
      return async () => {
        const startedAt = performance.now();
        const result = await redactText(input);
        const durationMs = performance.now() - startedAt;
        if (
          !result.ok ||
          result.value.includes("user@example.invalid") ||
          result.value.includes("https://service.example.invalid")
        ) {
          throw new Error(
            "text_16k did not redact the synthetic corpus safely",
          );
        }
        return durationMs;
      };
    }
    case "tool_arguments_100": {
      const input = Array.from({ length: 100 }, (_, index) => ({
        id: index,
        message: `person${index}@example.invalid`,
        tool: {
          endpoint: `https://tool.example.invalid/items/${index}`,
          owner: `owner${index}@example.invalid`,
        },
      }));
      return async () => {
        const startedAt = performance.now();
        const result = await redactJsonLike(input);
        const durationMs = performance.now() - startedAt;
        const serialized = result.ok ? JSON.stringify(result.value) : "";
        if (
          !result.ok ||
          serialized.includes("@example.invalid") ||
          serialized.includes("https://tool.example.invalid")
        ) {
          throw new Error(
            "tool_arguments_100 did not redact the synthetic corpus safely",
          );
        }
        return durationMs;
      };
    }
    default:
      throw new Error(`unknown performance case: ${caseName}`);
  }
}

function validateBaseline(
  baseline: PerformanceBaseline,
): asserts baseline is Required<PerformanceBaseline> {
  if (baseline.schemaVersion !== BASELINE_SCHEMA || !baseline.cases) {
    throw new Error("performance baseline configuration is invalid");
  }
  for (const [caseName, budget] of Object.entries(baseline.cases)) {
    requiredPositiveInteger(budget.iterations, `${caseName}.iterations`);
    const maxMedianMs = requiredPositiveNumber(
      budget.maxMedianMs,
      `${caseName}.maxMedianMs`,
    );
    const maxP95Ms = requiredPositiveNumber(
      budget.maxP95Ms,
      `${caseName}.maxP95Ms`,
    );
    if (maxMedianMs > maxP95Ms) {
      throw new Error(
        `${caseName} median budget must not exceed its p95 budget`,
      );
    }
  }
}

function requiredPositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value as number;
}

function requiredPositiveNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
  return value;
}

function roundMilliseconds(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  runPerformanceCheck().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown failure";
    process.stderr.write(`Performance check failed: ${message}\n`);
    process.exitCode = 1;
  });
}
