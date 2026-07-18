import type {
  RedactionOperationOptions,
  RedactionOptions,
  RedactionProfileExecutionOptions,
} from "../../core/src/index.js";

type AnthropicMessagesAdapterOptions = {
  redactToolNames?: boolean;
};

export type AnthropicMessagesOptions =
  | (RedactionOptions & AnthropicMessagesAdapterOptions)
  | (RedactionProfileExecutionOptions & AnthropicMessagesAdapterOptions);

export type AnthropicMessagesRedactionOptions = RedactionOperationOptions;
