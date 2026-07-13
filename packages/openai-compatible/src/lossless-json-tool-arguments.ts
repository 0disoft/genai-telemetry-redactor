import {
  redactToolArguments,
  type RedactionOptions,
  type RedactionResult,
  type SafeRedactionErrorCode,
} from "../../core/src/index.js";

const DEFAULT_MAX_STRING_LENGTH = 128_000;
const DEFAULT_MAX_OBJECT_DEPTH = 16;
const DEFAULT_MAX_OBJECT_KEYS = 1_000;
const DEFAULT_MAX_ARRAY_LENGTH = 1_000;
const DEFAULT_MAX_TOTAL_NODES = 10_000;

type JsonNode =
  | { kind: "string"; start: number; end: number; value: string }
  | { kind: "number"; raw: string }
  | { kind: "literal"; value: boolean | null }
  | { kind: "array"; items: JsonNode[] }
  | { kind: "object"; entries: JsonObjectEntry[] };

type JsonObjectEntry = {
  key: string;
  keyNode: Extract<JsonNode, { kind: "string" }>;
  value: JsonNode;
};

type Replacement = {
  start: number;
  end: number;
  value: string;
};

export async function redactJsonToolArgumentsString(
  input: string,
  options: RedactionOptions,
): Promise<RedactionResult<string>> {
  const root = new LosslessJsonParser(input, {
    maxStringLength:
      options.limits?.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH,
    maxObjectDepth: options.limits?.maxObjectDepth ?? DEFAULT_MAX_OBJECT_DEPTH,
    maxObjectKeys: options.limits?.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS,
    maxArrayLength: options.limits?.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH,
    maxTotalNodes: options.limits?.maxTotalNodes ?? DEFAULT_MAX_TOTAL_NODES,
  }).parse();
  const semanticValue = toSemanticValue(root);
  const result = await redactToolArguments(semanticValue, options);
  if (!result.ok) {
    return result;
  }

  const replacements: Replacement[] = [];
  collectStringReplacements(root, result.value, replacements);

  return {
    ...result,
    value: applyReplacements(input, replacements),
  };
}

export class LosslessJsonToolArgumentsError extends Error {
  constructor(
    readonly code: SafeRedactionErrorCode,
    readonly safeMessage: string,
  ) {
    super(code);
  }
}

type ParserLimits = {
  maxStringLength: number;
  maxObjectDepth: number;
  maxObjectKeys: number;
  maxArrayLength: number;
  maxTotalNodes: number;
};

class LosslessJsonParser {
  private index = 0;
  private totalNodes = 0;
  private readonly numberPattern =
    /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y;

  constructor(
    private readonly input: string,
    private readonly limits: ParserLimits,
  ) {}

  parse(): JsonNode {
    if (this.input.length > this.limits.maxStringLength) {
      this.failLimit(
        "max_string_length_exceeded",
        "Tool argument JSON exceeded the configured string length limit.",
      );
    }
    this.skipWhitespace();
    const value = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.input.length) {
      this.fail();
    }
    return value;
  }

  private parseValue(depth: number): JsonNode {
    if (depth > this.limits.maxObjectDepth) {
      this.failLimit(
        "max_object_depth_exceeded",
        "Tool argument JSON exceeded the configured object depth limit.",
      );
    }
    this.totalNodes += 1;
    if (this.totalNodes > this.limits.maxTotalNodes) {
      this.failLimit(
        "max_total_nodes_exceeded",
        "Tool argument JSON exceeded the configured node count limit.",
      );
    }

    const token = this.input[this.index];
    if (token === '"') {
      return this.parseString();
    }
    if (token === "{") {
      return this.parseObject(depth);
    }
    if (token === "[") {
      return this.parseArray(depth);
    }
    if (token === "t") {
      this.consumeKeyword("true");
      return { kind: "literal", value: true };
    }
    if (token === "f") {
      this.consumeKeyword("false");
      return { kind: "literal", value: false };
    }
    if (token === "n") {
      this.consumeKeyword("null");
      return { kind: "literal", value: null };
    }
    return this.parseNumber();
  }

  private parseObject(depth: number): JsonNode {
    this.index += 1;
    this.skipWhitespace();
    const entries: JsonObjectEntry[] = [];
    const keys = new Set<string>();
    if (this.consumeIf("}")) {
      return { kind: "object", entries };
    }

    while (true) {
      if (this.input[this.index] !== '"') {
        this.fail();
      }
      const keyNode = this.parseString();
      if (keys.has(keyNode.value)) {
        this.failLimit(
          "unsupported_json_like",
          "Tool argument JSON cannot contain duplicate object keys.",
        );
      }
      keys.add(keyNode.value);
      if (entries.length >= this.limits.maxObjectKeys) {
        this.failLimit(
          "max_object_keys_exceeded",
          "Tool argument JSON exceeded the configured object key limit.",
        );
      }
      this.skipWhitespace();
      this.consume(":");
      this.skipWhitespace();
      entries.push({
        key: keyNode.value,
        keyNode,
        value: this.parseValue(depth + 1),
      });
      this.skipWhitespace();
      if (this.consumeIf("}")) {
        break;
      }
      this.consume(",");
      this.skipWhitespace();
    }

    return { kind: "object", entries };
  }

  private parseArray(depth: number): JsonNode {
    this.index += 1;
    this.skipWhitespace();
    const items: JsonNode[] = [];
    if (this.consumeIf("]")) {
      return { kind: "array", items };
    }

    while (true) {
      if (items.length >= this.limits.maxArrayLength) {
        this.failLimit(
          "max_array_length_exceeded",
          "Tool argument JSON exceeded the configured array length limit.",
        );
      }
      items.push(this.parseValue(depth + 1));
      this.skipWhitespace();
      if (this.consumeIf("]")) {
        break;
      }
      this.consume(",");
      this.skipWhitespace();
    }

    return { kind: "array", items };
  }

  private parseString(): Extract<JsonNode, { kind: "string" }> {
    const start = this.index;
    this.index += 1;
    let escaped = false;

    while (this.index < this.input.length) {
      const code = this.input.charCodeAt(this.index);
      if (!escaped && code === 0x22) {
        this.index += 1;
        const raw = this.input.slice(start, this.index);
        try {
          return {
            kind: "string",
            start,
            end: this.index,
            value: JSON.parse(raw) as string,
          };
        } catch {
          this.fail();
        }
      }
      if (!escaped && code < 0x20) {
        this.fail();
      }
      if (!escaped && code === 0x5c) {
        escaped = true;
      } else {
        escaped = false;
      }
      this.index += 1;
    }

    this.fail();
  }

  private parseNumber(): JsonNode {
    this.numberPattern.lastIndex = this.index;
    const match = this.numberPattern.exec(this.input);
    if (!match) {
      this.fail();
    }
    this.index = this.numberPattern.lastIndex;
    return { kind: "number", raw: match[0] };
  }

  private consumeKeyword(keyword: string) {
    if (!this.input.startsWith(keyword, this.index)) {
      this.fail();
    }
    this.index += keyword.length;
  }

  private consume(expected: string) {
    if (!this.consumeIf(expected)) {
      this.fail();
    }
  }

  private consumeIf(expected: string) {
    if (this.input[this.index] !== expected) {
      return false;
    }
    this.index += 1;
    return true;
  }

  private skipWhitespace() {
    while (
      this.input[this.index] === " " ||
      this.input[this.index] === "\t" ||
      this.input[this.index] === "\r" ||
      this.input[this.index] === "\n"
    ) {
      this.index += 1;
    }
  }

  private fail(): never {
    throw new SyntaxError("Malformed JSON tool arguments.");
  }

  private failLimit(code: SafeRedactionErrorCode, message: string): never {
    throw new LosslessJsonToolArgumentsError(code, message);
  }
}

function toSemanticValue(node: JsonNode): unknown {
  switch (node.kind) {
    case "string":
      return node.value;
    case "number":
      return 0;
    case "literal":
      return node.value;
    case "array":
      return node.items.map(toSemanticValue);
    case "object": {
      const value: Record<string, unknown> = Object.create(null);
      for (const entry of node.entries) {
        Object.defineProperty(value, entry.key, {
          configurable: true,
          enumerable: true,
          value: toSemanticValue(entry.value),
          writable: true,
        });
      }
      return value;
    }
  }
}

function collectStringReplacements(
  node: JsonNode,
  redactedValue: unknown,
  replacements: Replacement[],
) {
  switch (node.kind) {
    case "string":
      if (typeof redactedValue !== "string") {
        throw new TypeError("Redacted JSON string value changed type.");
      }
      if (redactedValue !== node.value) {
        replacements.push({
          start: node.start,
          end: node.end,
          value: JSON.stringify(redactedValue),
        });
      }
      return;
    case "number":
    case "literal":
      return;
    case "array":
      if (!Array.isArray(redactedValue)) {
        throw new TypeError("Redacted JSON array value changed type.");
      }
      for (const [index, item] of node.items.entries()) {
        collectStringReplacements(item, redactedValue[index], replacements);
      }
      return;
    case "object":
      if (
        redactedValue === null ||
        typeof redactedValue !== "object" ||
        Array.isArray(redactedValue)
      ) {
        throw new TypeError("Redacted JSON object value changed type.");
      }
      for (const entry of node.entries) {
        const descriptor = Object.getOwnPropertyDescriptor(
          redactedValue,
          entry.key,
        );
        if (!descriptor || !("value" in descriptor)) {
          throw new TypeError("Redacted JSON object property is missing.");
        }
        collectStringReplacements(entry.value, descriptor.value, replacements);
      }
  }
}

function applyReplacements(input: string, replacements: Replacement[]) {
  if (replacements.length === 0) {
    return input;
  }

  const parts: string[] = [];
  let cursor = 0;
  for (const replacement of replacements.sort(
    (left, right) => left.start - right.start,
  )) {
    if (replacement.start < cursor || replacement.end < replacement.start) {
      throw new TypeError("JSON string replacements overlap.");
    }
    parts.push(input.slice(cursor, replacement.start), replacement.value);
    cursor = replacement.end;
  }
  parts.push(input.slice(cursor));
  return parts.join("");
}
