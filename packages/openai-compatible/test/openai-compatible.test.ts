import { describe, expect, it } from "vitest";
import {
  redactOpenAICompatibleRequest,
  redactOpenAICompatibleResponse,
  redactOpenAICompatibleStreamEvent,
} from "../src/index.js";

describe("OpenAI-compatible adapter", () => {
  it("redacts request message content and prompt strings", async () => {
    const result = await redactOpenAICompatibleRequest({
      model: "model_example",
      messages: [
        {
          role: "user",
          content: "Email user@example.invalid and key_example_value",
        },
      ],
      prompt: "Reach https://example.invalid/private",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result.value)).not.toContain("key_example_value");
    expect(JSON.stringify(result.value)).not.toContain(
      "https://example.invalid/private",
    );
    expect(result.report.totalRedactions).toBe(3);
  });

  it("redacts response content and JSON string tool arguments", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Contact user@example.invalid",
            tool_calls: [
              {
                id: "call_example",
                type: "function",
                function: {
                  name: "lookup",
                  arguments: JSON.stringify({
                    endpoint: "https://example.invalid/customer",
                    token: "token_example_value",
                  }),
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("https://example.invalid/customer");
    expect(output).not.toContain("token_example_value");
    expect(output).toContain("[REDACTED:email]");
    expect(output).toContain("[REDACTED:url]");
    expect(output).toContain("[REDACTED:api_key]");
    expect(result.report.totalRedactions).toBe(3);
  });

  it("redacts nested request input and multimodal content parts", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Contact user@example.invalid",
            },
            {
              type: "image_url",
              image_url: {
                url: "https://example.invalid/message-image",
              },
            },
          ],
        },
      ],
      input: [
        {
          type: "input_text",
          text: "Reach second@example.invalid",
        },
        {
          type: "input_image",
          image_url: {
            url: "https://example.invalid/private-image",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const output = JSON.stringify(result.value);
    expect(output).not.toContain("user@example.invalid");
    expect(output).not.toContain("second@example.invalid");
    expect(output).not.toContain("https://example.invalid/message-image");
    expect(output).not.toContain("https://example.invalid/private-image");
    expect(output).toContain("[REDACTED:email]");
    expect(output).toContain("[REDACTED:url]");
    expect(result.report.totalRedactions).toBe(4);
  });

  it("redacts malformed tool argument strings as text and warns", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          message: {
            tool_calls: [
              {
                function: {
                  arguments: "{ token: token_example_value",
                },
              },
            ],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(JSON.stringify(result.value)).not.toContain("token_example_value");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "malformed_tool_arguments" }),
    );
  });

  it("omits streaming content and returns metadata-only warning", () => {
    const result = redactOpenAICompatibleStreamEvent({
      choices: [
        {
          delta: {
            content: "user@example.invalid",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value).toEqual({
      contentOmitted: true,
      warningCode: "streaming_content_omitted",
    });
    expect(JSON.stringify(result.value)).not.toContain("user@example.invalid");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({ code: "streaming_content_omitted" }),
    );
  });

  it("fails closed for non-object request input", async () => {
    const result = await redactOpenAICompatibleRequest("user@example.invalid");

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.error.message).not.toContain("user@example.invalid");
  });

  it("fails closed for unsupported request shapes without known content fields", async () => {
    const result = await redactOpenAICompatibleRequest({
      unknown_content: "user@example.invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.{0}",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for unsupported response shapes", async () => {
    const result = await redactOpenAICompatibleResponse({
      output_text: "user@example.invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.{0}",
      }),
    );
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
  });

  it("fails closed for malformed message arrays that could carry raw content", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: ["user@example.invalid"],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.messages[0]",
      }),
    );
  });

  it("fails closed when response choices carry streaming delta content", async () => {
    const result = await redactOpenAICompatibleResponse({
      choices: [
        {
          delta: {
            content: "user@example.invalid",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsupported_provider_shape");
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(result.report.warnings).toContainEqual(
      expect.objectContaining({
        code: "unsupported_provider_shape",
        path: "$.choices[0].{0}",
      }),
    );
  });

  it("preserves prior redaction counts when a later provider shape fails", async () => {
    const result = await redactOpenAICompatibleRequest({
      messages: [
        {
          role: "user",
          content: "Contact user@example.invalid",
        },
        {
          role: "user",
          content: [
            {
              token_example_value: true,
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error.code).toBe("unsafe_object_key");
    expect(result.report.totalRedactions).toBe(1);
    expect(JSON.stringify(result)).not.toContain("user@example.invalid");
    expect(JSON.stringify(result)).not.toContain("token_example_value");
  });
});
