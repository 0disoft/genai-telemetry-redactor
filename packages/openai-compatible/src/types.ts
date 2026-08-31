import type {
  RedactionOperationOptions,
  RedactionOptions,
  RedactionProfileExecutionOptions,
  RedactionResult,
} from "../../core/src/index.js";

type OpenAICompatibleAdapterOptions = {
  redactToolNames?: boolean;
};

type OpenAICompatibleStreamAdapterOptions = OpenAICompatibleAdapterOptions & {
  captureContent?: boolean;
};

export type OpenAICompatibleOptions =
  | (RedactionOptions & OpenAICompatibleAdapterOptions)
  | (RedactionProfileExecutionOptions & OpenAICompatibleAdapterOptions);

export type OpenAICompatibleRedactionOptions = RedactionOperationOptions;

export type OpenAICompatibleStreamRedactionMetadata = {
  contentOmitted: true;
  warningCode: "streaming_content_omitted";
};

export type OpenAICompatibleStreamOptions =
  | (RedactionOptions & OpenAICompatibleStreamAdapterOptions)
  | (RedactionProfileExecutionOptions & OpenAICompatibleStreamAdapterOptions);

export type OpenAICompatibleStreamToolCall = {
  index: number;
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
};

export type OpenAICompatibleStreamChoice = {
  index: number;
  text?: string;
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OpenAICompatibleStreamToolCall[];
  };
  finish_reason?: string | null;
};

export type OpenAICompatibleStreamFinalResult = {
  contentOmitted: false;
  choices: OpenAICompatibleStreamChoice[];
};

export type OpenAICompatibleStreamRedactor = {
  push(
    input: unknown,
  ): RedactionResult<OpenAICompatibleStreamRedactionMetadata>;
  close(): Promise<
    RedactionResult<
      | OpenAICompatibleStreamFinalResult
      | OpenAICompatibleStreamRedactionMetadata
    >
  >;
};
