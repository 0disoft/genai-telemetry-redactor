import type {
  RedactionOperationOptions,
  RedactionOptions,
  RedactionProfileExecutionOptions,
} from "../../core/src/index.js";

type OpenAICompatibleAdapterOptions = {
  redactToolNames?: boolean;
};

export type OpenAICompatibleOptions =
  | (RedactionOptions & OpenAICompatibleAdapterOptions)
  | (RedactionProfileExecutionOptions & OpenAICompatibleAdapterOptions);

export type OpenAICompatibleRedactionOptions = RedactionOperationOptions;

export type OpenAICompatibleStreamRedactionMetadata = {
  contentOmitted: true;
  warningCode: "streaming_content_omitted";
};
