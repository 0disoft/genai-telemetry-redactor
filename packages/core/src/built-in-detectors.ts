import type {
  BuiltInDetectorName,
  Detection,
  Detector,
  RedactionReason,
  RegexDetectorOptions,
} from "./types.js";

const EMAIL_PATTERN =
  /\b[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g;
const URL_PATTERN = /\bhttps?:\/\/[^\s"'<>]+/g;
const API_KEY_PATTERN =
  /\b(?:(?:sk|pk|api|key|token)_(?:test_)?[A-Za-z0-9][A-Za-z0-9_-]{5,}|sk-(?:proj-)?[A-Za-z0-9][A-Za-z0-9_-]{11,})\b/g;
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
        return createRegexDetector({
          id: "builtin:email",
          reason: "email",
          pattern: EMAIL_PATTERN,
        });
      case "bearer_token":
        return createRegexDetector({
          id: "builtin:bearer_token",
          reason: "bearer_token",
          pattern: BEARER_PATTERN,
          toDetection(match) {
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
        });
      case "api_key":
        return createRegexDetector({
          id: "builtin:api_key",
          reason: "api_key",
          pattern: API_KEY_PATTERN,
        });
      case "url":
        return createRegexDetector({
          id: "builtin:url",
          reason: "url",
          pattern: URL_PATTERN,
        });
      default:
        throw new TypeError("Unknown built-in detector name.");
    }
  });
}

export function createRegexDetector(options: RegexDetectorOptions): Detector {
  return {
    id: options.id,
    reasons: [options.reason],
    detect(input) {
      const matches: Detection[] = [];
      const pattern = toGlobalPattern(options.pattern);

      for (
        let match = pattern.exec(input);
        match;
        match = pattern.exec(input)
      ) {
        if (match[0].length === 0) {
          pattern.lastIndex += 1;
          continue;
        }

        const detection = options.toDetection
          ? options.toDetection(match)
          : {
              reason: options.reason,
              start: match.index,
              end: match.index + match[0].length,
            };

        if (detection) {
          matches.push(detection);
        }
      }

      return matches;
    },
  };
}

function toGlobalPattern(pattern: RegExp): RegExp {
  const flags = new Set(pattern.flags);
  flags.delete("y");
  flags.add("g");
  return new RegExp(pattern.source, [...flags].join(""));
}
