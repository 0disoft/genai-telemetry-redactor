import type {
  BuiltInDetectorName,
  Detection,
  Detector,
  RedactionReason,
} from "./types.js";

type MatchFactory = (match: RegExpExecArray) => Detection | undefined;

const EMAIL_PATTERN =
  /\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/g;
const API_KEY_PATTERN =
  /\b(?:sk|pk|api|key|token)_(?:test_)?[A-Za-z0-9][A-Za-z0-9_-]{5,}\b/g;
const BEARER_PATTERN = /\b[Bb]earer\s+([A-Za-z0-9._~+/=-]{6,})/g;

const DEFAULT_BUILT_INS: readonly BuiltInDetectorName[] = [
  "email",
  "bearer_token",
  "api_key",
  "url",
];

export function createBuiltInDetectors(
  names: readonly BuiltInDetectorName[] = DEFAULT_BUILT_INS,
): Detector[] {
  return names.map((name) => {
    switch (name) {
      case "email":
        return createRegexDetector("builtin:email", "email", EMAIL_PATTERN);
      case "bearer_token":
        return createRegexDetector(
          "builtin:bearer_token",
          "bearer_token",
          BEARER_PATTERN,
          (match) => {
            const token = match[1];
            if (!token) {
              return undefined;
            }

            const tokenStart = match.index + match[0].lastIndexOf(token);
            return {
              reason: "bearer_token",
              start: tokenStart,
              end: tokenStart + token.length,
            };
          },
        );
      case "api_key":
        return createRegexDetector(
          "builtin:api_key",
          "api_key",
          API_KEY_PATTERN,
        );
      case "url":
        return createRegexDetector("builtin:url", "url", URL_PATTERN);
    }
  });
}

function createRegexDetector(
  id: string,
  reason: RedactionReason,
  pattern: RegExp,
  toDetection: MatchFactory = (match) => ({
    reason,
    start: match.index,
    end: match.index + match[0].length,
  }),
): Detector {
  return {
    id,
    reasons: [reason],
    detect(input) {
      const matches: Detection[] = [];
      pattern.lastIndex = 0;

      for (
        let match = pattern.exec(input);
        match;
        match = pattern.exec(input)
      ) {
        const detection = toDetection(match);
        if (detection) {
          matches.push(detection);
        }
      }

      return matches;
    },
  };
}
