import { describe, expect, it } from "vitest";
import {
  redactOpenAICompatibleRequest,
  redactOpenAICompatibleResponse,
} from "../src/index.js";

const FUZZ_CASES = 64;
const SENSITIVE_VALUES = [
  "user@example.invalid",
  "key_example_value",
  "https://example.invalid/private",
  ["Bearer", "token_example_value"].join(" "),
] as const;

describe("OpenAI-compatible no-leak fuzz invariants", () => {
  it("redacts seeded valid request shapes", async () => {
    for (let seed = 1; seed <= FUZZ_CASES; seed += 1) {
      const sensitiveValue = sensitiveValueForSeed(seed);
      const result = await redactOpenAICompatibleRequest(
        createRequest(seed, sensitiveValue),
      );

      expect(result.ok, `request seed ${seed}`).toBe(true);
      if (!result.ok) {
        continue;
      }

      expect(JSON.stringify(result), `request seed ${seed}`).not.toContain(
        sensitiveValue,
      );
      expect(
        result.report.totalRedactions,
        `request seed ${seed}`,
      ).toBeGreaterThan(0);
    }
  });

  it("redacts seeded valid response shapes", async () => {
    for (let seed = 1; seed <= FUZZ_CASES; seed += 1) {
      const sensitiveValue = sensitiveValueForSeed(seed);
      const result = await redactOpenAICompatibleResponse(
        createResponse(seed, sensitiveValue),
      );

      expect(result.ok, `response seed ${seed}`).toBe(true);
      if (!result.ok) {
        continue;
      }

      expect(JSON.stringify(result), `response seed ${seed}`).not.toContain(
        sensitiveValue,
      );
      expect(
        result.report.totalRedactions,
        `response seed ${seed}`,
      ).toBeGreaterThan(0);
    }
  });

  it("fails closed for seeded unknown content-bearing shapes", async () => {
    for (let seed = 1; seed <= FUZZ_CASES; seed += 1) {
      const sensitiveValue = sensitiveValueForSeed(seed);
      const result = await redactOpenAICompatibleRequest({
        [`unknown_field_${seed}`]: {
          content: sensitiveValue,
        },
      });

      expect(result.ok, `unknown seed ${seed}`).toBe(false);
      expect(JSON.stringify(result), `unknown seed ${seed}`).not.toContain(
        sensitiveValue,
      );
      if (!result.ok) {
        expect(result.error.code, `unknown seed ${seed}`).toBe(
          "unsupported_provider_shape",
        );
      }
    }
  });
});

function createRequest(seed: number, sensitiveValue: string): unknown {
  const content = `prefix ${sensitiveValue} suffix`;
  switch (seed % 4) {
    case 0:
      return { messages: [{ role: "user", content }] };
    case 1:
      return { prompt: content };
    case 2:
      return { input: content };
    default:
      return {
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: content }],
          },
        ],
      };
  }
}

function createResponse(seed: number, sensitiveValue: string): unknown {
  const content = `prefix ${sensitiveValue} suffix`;
  switch (seed % 3) {
    case 0:
      return { choices: [{ text: content }] };
    case 1:
      return { choices: [{ message: { role: "assistant", content } }] };
    default:
      return {
        choices: [
          {
            message: {
              role: "assistant",
              tool_calls: [
                {
                  id: `call_example_${seed}`,
                  type: "function",
                  function: {
                    name: "lookup",
                    arguments: JSON.stringify({ value: sensitiveValue }),
                  },
                },
              ],
            },
          },
        ],
      };
  }
}

function sensitiveValueForSeed(seed: number): string {
  return (
    SENSITIVE_VALUES[seed % SENSITIVE_VALUES.length] ?? SENSITIVE_VALUES[0]
  );
}
