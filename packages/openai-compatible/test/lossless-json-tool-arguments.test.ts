import { describe, expect, it } from "vitest";
import { redactJsonToolArgumentsString } from "../src/lossless-json-tool-arguments.js";

const VALID_JSON_CORPUS = [
  "null",
  "true",
  "false",
  "0",
  "-0",
  "9007199254740993",
  "-9007199254740993",
  "1.2300e+4",
  "1E-400",
  '"safe\\u0020value"',
  '"escaped \\\\ slash and \\\" quote"',
  "[]",
  "{}",
  "[0,-0,9007199254740993,1.2300e+4,true,false,null]",
  '{"nested":{"items":["safe",9007199254740993]}}',
  '{ "__proto__": { "safe": true }, "constructor": "metadata" }',
] as const;

const INVALID_JSON_CORPUS = [
  "",
  "undefined",
  "01",
  "+1",
  ".1",
  "1.",
  "1e",
  "NaN",
  "Infinity",
  "[1,]",
  '{"key":}',
  "{key:1}",
  '"unterminated',
  '"bad\\xescape"',
  '"raw\nnewline"',
] as const;

describe("lossless JSON tool arguments", () => {
  it.each(VALID_JSON_CORPUS)(
    "accepts valid JSON without rewriting unchanged tokens: %s",
    async (input) => {
      expect(() => JSON.parse(input)).not.toThrow();

      const result = await redactJsonToolArgumentsString(input, {
        builtInDetectors: false,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.value).toBe(input);
    },
  );

  it.each(INVALID_JSON_CORPUS)(
    "rejects invalid JSON syntax: %s",
    async (input) => {
      expect(() => JSON.parse(input)).toThrow(SyntaxError);
      await expect(
        redactJsonToolArgumentsString(input, { builtInDetectors: false }),
      ).rejects.toThrow(SyntaxError);
    },
  );

  it("redacts the maximum default array in one reconstruction pass", async () => {
    const items = Array.from(
      { length: 1_000 },
      (_, index) =>
        `{"id":${9007199254740993n + BigInt(index)},"contact":"user${index}@example.invalid"}`,
    );
    const input = `[${items.join(",")}]`;

    const result = await redactJsonToolArgumentsString(input, {
      builtInDetectors: ["email"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.report.totalRedactions).toBe(1_000);
    expect(result.value).toContain('"id":9007199254740993');
    expect(result.value).toContain('"id":9007199254741992');
    expect(result.value.match(/\[REDACTED:email\]/g)).toHaveLength(1_000);
    expect(result.value).not.toContain("user0@example.invalid");
    expect(result.value).not.toContain("user999@example.invalid");
  });

  it("rejects duplicate keys after decoding escapes", async () => {
    await expect(
      redactJsonToolArgumentsString('{"contact":1,"cont\\u0061ct":2}', {
        builtInDetectors: false,
      }),
    ).rejects.toMatchObject({ code: "unsupported_json_like" });
  });
});
