import type { RedactionOptions } from "../../core/src/index.js";

export type OpenAICompatibleOptions = RedactionOptions & {
  redactToolNames?: boolean;
};

export type OpenAICompatibleStreamRedactionMetadata = {
  contentOmitted: true;
  warningCode: "streaming_content_omitted";
};
