import { describe, expect, it } from "vitest";

import { createRedactionProfile } from "../../core/src/index.js";
import {
  redactAnthropicMessagesRequest,
  redactAnthropicMessagesResponse,
} from "../src/index.js";

describe("Anthropic Messages adapter", () => {
  it("redacts top-level system text and string message content", async () => {
    const result = await redactAnthropicMessagesRequest({
      model: "model_example",
      max_tokens: 128,
      system: "Contact system@example.invalid",
      messages: [{ role: "user", content: "Contact user@example.invalid" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.system).toBe("Contact [REDACTED:email]");
    expect(result.value.messages[0]?.content).toBe("Contact [REDACTED:email]");
    expect(result.report.totalRedactions).toBe(2);
  });

  it("redacts top-level system and message text blocks", async () => {
    const result = await redactAnthropicMessagesRequest({
      system: [{ type: "text", text: "System system@example.invalid" }],
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: "User user@example.invalid" }],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.system[0]?.text).toBe("System [REDACTED:email]");
    expect(result.value.messages[0]?.content[0]?.text).toBe(
      "User [REDACTED:email]",
    );
  });

  it("redacts assistant tool_use input and user tool_result content", async () => {
    const result = await redactAnthropicMessagesRequest({
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_use",
              id: "toolu_example",
              name: "lookup_contact",
              input: { email: "tool@example.invalid" },
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_example",
              content: "Found result@example.invalid",
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.messages[0]?.content[0]).toMatchObject({
      input: { email: "[REDACTED:email]" },
    });
    expect(result.value.messages[1]?.content[0]).toMatchObject({
      content: "Found [REDACTED:email]",
    });
  });

  it("redacts nested text blocks inside tool_result", async () => {
    const result = await redactAnthropicMessagesRequest({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_example",
              is_error: false,
              content: [
                { type: "text", text: "Result result@example.invalid" },
              ],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.messages[0]?.content[0]?.content[0]?.text).toBe(
      "Result [REDACTED:email]",
    );
  });

  it("redacts content-bearing tool definitions and metadata", async () => {
    const result = await redactAnthropicMessagesRequest({
      metadata: { user_id: "user@example.invalid" },
      tools: [
        {
          name: "lookup_contact",
          description: "Look up tool@example.invalid",
          input_schema: {
            type: "object",
            properties: { email: { type: "string" } },
          },
        },
      ],
      messages: [{ role: "user", content: "Safe request" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.metadata.user_id).toBe("[REDACTED:email]");
    expect(result.value.tools[0]?.description).toBe("Look up [REDACTED:email]");
  });

  it("redacts response text and tool_use input", async () => {
    const result = await redactAnthropicMessagesResponse({
      id: "msg_example",
      type: "message",
      role: "assistant",
      model: "model_example",
      content: [
        { type: "text", text: "Contact response@example.invalid" },
        {
          type: "tool_use",
          id: "toolu_example",
          name: "lookup_contact",
          input: { email: "input@example.invalid" },
        },
      ],
      stop_reason: "tool_use",
      stop_sequence: null,
      usage: { input_tokens: 12, output_tokens: 8 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.content[0]?.text).toBe("Contact [REDACTED:email]");
    expect(result.value.content[1]).toMatchObject({
      input: { email: "[REDACTED:email]" },
    });
  });

  it("keeps tool names by default and redacts them only by explicit policy", async () => {
    const payload = {
      content: [
        {
          type: "tool_use",
          id: "toolu_example",
          name: "user@example.invalid",
          input: {},
        },
      ],
    };
    const defaultResult = await redactAnthropicMessagesResponse(payload);
    const optInResult = await redactAnthropicMessagesResponse(payload, {
      redactToolNames: true,
    });

    expect(defaultResult.ok).toBe(true);
    expect(optInResult.ok).toBe(true);
    if (!defaultResult.ok || !optInResult.ok) return;
    expect(defaultResult.value.content[0]?.name).toBe("user@example.invalid");
    expect(optInResult.value.content[0]?.name).toBe("[REDACTED:email]");
  });

  it("accepts reusable redaction profiles", async () => {
    const profile = createRedactionProfile({ builtInDetectors: ["email"] });
    expect(profile.ok).toBe(true);
    if (!profile.ok) return;

    const result = await redactAnthropicMessagesRequest(
      { messages: [{ role: "user", content: "user@example.invalid" }] },
      { profile: profile.value },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.messages[0]?.content).toBe("[REDACTED:email]");
  });

  it("fails closed for unsupported content block types", async () => {
    const result = await redactAnthropicMessagesRequest({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "text", data: "user@example.invalid" },
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result).not.toHaveProperty("value");
  });

  it("fails closed when tool blocks appear under the wrong role", async () => {
    const userToolUse = await redactAnthropicMessagesRequest({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "tool_use",
              id: "toolu_example",
              name: "lookup_contact",
              input: {},
            },
          ],
        },
      ],
    });
    const assistantToolResult = await redactAnthropicMessagesRequest({
      messages: [
        {
          role: "assistant",
          content: [
            {
              type: "tool_result",
              tool_use_id: "toolu_example",
              content: "safe",
            },
          ],
        },
      ],
    });

    expect(userToolUse.ok).toBe(false);
    expect(assistantToolResult.ok).toBe(false);
  });

  it("fails closed for unknown top-level fields", async () => {
    const result = await redactAnthropicMessagesRequest({
      messages: [{ role: "user", content: "safe" }],
      provider_extension: "user@example.invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unsupported_provider_shape");
  });

  it("fails closed for accessors without reading their values", async () => {
    const payload = { messages: [{ role: "user", content: "safe" }] };
    Object.defineProperty(payload, "system", {
      enumerable: true,
      get() {
        throw new Error("synthetic provider getter");
      },
    });

    const result = await redactAnthropicMessagesRequest(payload);

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("synthetic provider getter");
  });

  it("applies one cumulative redaction budget across the request", async () => {
    const result = await redactAnthropicMessagesRequest(
      {
        system: "system@example.invalid",
        messages: [{ role: "user", content: "user@example.invalid" }],
      },
      { limits: { maxTotalDetections: 1 } },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("max_total_detections_exceeded");
    expect(result).not.toHaveProperty("value");
  });
});
