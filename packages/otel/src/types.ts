import type { RedactionReport } from "../../core/src/index.js";

export type OtelAttributeValue =
  | string
  | number
  | boolean
  | readonly string[]
  | readonly number[]
  | readonly boolean[];

export type OtelGenAIAttributeMap = Record<string, OtelAttributeValue>;

export type OtelGenAITokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type OtelGenAIMetadataOptions = {
  operationName?: string;
  providerName?: string;
  requestModel?: string;
  responseModel?: string;
  tokenUsage?: OtelGenAITokenUsage;
  latencyMs?: number;
  errorClass?: string;
  captureContent?: false;
  conventionLabel?: string;
};

export type OtelGenAIMetadata = {
  attributes: OtelGenAIAttributeMap;
  droppedMetadataKeys: readonly string[];
};

export type OtelGenAIMetadataMapper = (
  report: RedactionReport,
  options?: OtelGenAIMetadataOptions,
) => OtelGenAIMetadata;
