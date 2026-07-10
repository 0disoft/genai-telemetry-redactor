import { describe, expect, it } from "vitest";
import {
  createBufferedTextStreamRedactor,
  redactJsonLike,
} from "../src/index.js";

type JsonLike =
  null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

const FUZZ_CASES = 64;
const SENSITIVE_VALUES = [
  "user@example.invalid",
  "key_example_value",
  "https://example.invalid/private",
  ["Bearer", "token_example_value"].join(" "),
] as const;

describe("core no-leak fuzz invariants", () => {
  it("redacts seeded JSON-like payloads without mutating their inputs", async () => {
    for (let seed = 1; seed <= FUZZ_CASES; seed += 1) {
      const random = createSeededRandom(seed);
      const guaranteedSensitiveValue = sensitiveValueForSeed(seed);
      const input = {
        caseId: seed,
        payload: generateJsonLike(random, 0),
        guaranteedSensitiveValue,
      } satisfies JsonLike;
      const inputBeforeRedaction = JSON.stringify(input);

      const result = await redactJsonLike(input);

      expect(result.ok, `seed ${seed}`).toBe(true);
      if (!result.ok) {
        continue;
      }

      const serializedResult = JSON.stringify(result);
      for (const sensitiveValue of SENSITIVE_VALUES) {
        if (inputBeforeRedaction.includes(sensitiveValue)) {
          expect(serializedResult, `seed ${seed}`).not.toContain(
            sensitiveValue,
          );
        }
      }
      expect(result.report.totalRedactions, `seed ${seed}`).toBeGreaterThan(0);
      expect(JSON.stringify(input), `seed ${seed}`).toBe(inputBeforeRedaction);
    }
  });

  it("redacts sensitive text across every two-chunk split boundary", async () => {
    const input = [
      "Contact",
      SENSITIVE_VALUES[0],
      "with",
      SENSITIVE_VALUES[1],
      "at",
      SENSITIVE_VALUES[2],
      "using",
      SENSITIVE_VALUES[3],
    ].join(" ");

    for (let splitAt = 1; splitAt < input.length; splitAt += 1) {
      const stream = createBufferedTextStreamRedactor();
      const first = stream.push(input.slice(0, splitAt));
      const second = stream.push(input.slice(splitAt));
      const result = await stream.close();

      expect(first.ok, `split ${splitAt}`).toBe(true);
      expect(second.ok, `split ${splitAt}`).toBe(true);
      expect(result.ok, `split ${splitAt}`).toBe(true);
      if (!first.ok || !second.ok || !result.ok) {
        continue;
      }

      expect(first.value.content, `split ${splitAt}`).toBe("");
      expect(second.value.content, `split ${splitAt}`).toBe("");
      const serializedResult = JSON.stringify(result);
      for (const sensitiveValue of SENSITIVE_VALUES) {
        expect(serializedResult, `split ${splitAt}`).not.toContain(
          sensitiveValue,
        );
      }
    }
  });
});

function generateJsonLike(random: () => number, depth: number): JsonLike {
  if (depth >= 3 || random() < 0.45) {
    return generateLeaf(random);
  }

  if (random() < 0.5) {
    const length = 1 + Math.floor(random() * 4);
    return Array.from({ length }, () => generateJsonLike(random, depth + 1));
  }

  const fieldCount = 1 + Math.floor(random() * 4);
  return Object.fromEntries(
    Array.from({ length: fieldCount }, (_, index) => [
      `field_${depth}_${index}`,
      generateJsonLike(random, depth + 1),
    ]),
  );
}

function generateLeaf(random: () => number): JsonLike {
  const variant = Math.floor(random() * 7);
  if (variant < SENSITIVE_VALUES.length) {
    return `prefix ${SENSITIVE_VALUES[variant]} suffix`;
  }
  if (variant === 4) {
    return null;
  }
  if (variant === 5) {
    return random() < 0.5;
  }
  return Math.floor(random() * 10_000);
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function sensitiveValueForSeed(seed: number): string {
  return (
    SENSITIVE_VALUES[seed % SENSITIVE_VALUES.length] ?? SENSITIVE_VALUES[0]
  );
}
