import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

type PackResult = {
  filename?: string;
};

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
const PACKAGE_NAME = "genai-telemetry-redactor";
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

const tempRoot = await mkdtemp(
  path.join(tmpdir(), "genai-telemetry-redactor-consumer-"),
);

try {
  const tarballPath = await packTarball(tempRoot);
  const consumerRoot = path.join(tempRoot, "consumer");
  await writeConsumerProject(consumerRoot, tarballPath);

  await runNpm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    consumerRoot,
  );
  await runNode([tscPath, "--project", "tsconfig.json"], consumerRoot);
  await runNode(["consumer-runtime.mjs"], consumerRoot);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

async function packTarball(destination: string) {
  const { stdout } = await runNpm(
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination],
    ROOT,
  );
  const parsed = JSON.parse(stdout) as PackResult[];
  const [packResult] = parsed;

  if (parsed.length !== 1 || !packResult) {
    throw new Error(`npm pack returned ${parsed.length} artifacts`);
  }

  const tarballs = (await readdir(destination))
    .filter((entry) => entry.endsWith(".tgz"))
    .sort((left, right) => left.localeCompare(right));

  if (tarballs.length !== 1) {
    throw new Error(
      `expected one packed tarball in ${destination}, found ${tarballs.length}`,
    );
  }

  const tarballName = tarballs[0];
  if (!tarballName) {
    throw new Error(`expected packed tarball in ${destination}`);
  }

  const packedFilename = packResult.filename
    ? path.basename(packResult.filename)
    : tarballName;

  if (packedFilename !== tarballName) {
    throw new Error(
      `npm pack reported ${packedFilename}, but ${tarballName} was written`,
    );
  }

  return path.join(destination, tarballName);
}

async function writeConsumerProject(consumerRoot: string, tarballPath: string) {
  await mkdir(consumerRoot, { recursive: true });
  const tarballSpec = `file:${normalizeSpecifierPath(
    path.relative(consumerRoot, tarballPath),
  )}`;

  await writeFile(
    path.join(consumerRoot, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          [PACKAGE_NAME]: tarballSpec,
        },
      },
      null,
      2,
    ) + "\n",
  );

  await writeFile(
    path.join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2024",
          lib: ["ES2024"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer-types.ts"],
      },
      null,
      2,
    )}\n`,
  );

  await writeFile(
    path.join(consumerRoot, "consumer-types.ts"),
    `import { createRedactionProfile, redactText } from "${PACKAGE_NAME}";
import { redactText as redactCore, type RedactionProfileCreationResult, type RedactionResult } from "${PACKAGE_NAME}/core";
import { redactOpenAICompatibleRequest, type OpenAICompatibleRedactionOptions } from "${PACKAGE_NAME}/openai-compatible";
import { mapRedactionReportToGenAIMetadata } from "${PACKAGE_NAME}/otel";
import { withRedactedTelemetry, type WithRedactedTelemetryResult } from "${PACKAGE_NAME}/sdk";

const rootResult: RedactionResult<string> = await redactText("hello@example.com");
const coreResult: RedactionResult<string> = await redactCore("Bearer abc.def.ghi");
const profileResult: RedactionProfileCreationResult = createRedactionProfile({
  builtInDetectors: ["email"],
});
if (profileResult.ok) {
  await redactText("profile@example.com", { profile: profileResult.value });
  const profileOperation: OpenAICompatibleRedactionOptions = {
    profile: profileResult.value,
  };
  await redactOpenAICompatibleRequest(
    { prompt: "adapter-profile@example.com" },
    profileOperation,
  );
  await withRedactedTelemetry({
    adapter: "openai-compatible",
    request: { prompt: "sdk-profile@example.com" },
    redaction: profileOperation,
  });
}
const requestResult = await redactOpenAICompatibleRequest({
  messages: [{ role: "user", content: "hello@example.com" }],
});

if (rootResult.ok) {
  mapRedactionReportToGenAIMetadata(rootResult.report, {
    operationName: "chat",
    providerName: "openai",
  });
}

const sdkResult: WithRedactedTelemetryResult = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: { messages: [{ role: "user", content: "hello@example.com" }] },
});

void coreResult;
void requestResult;
void sdkResult;
`,
  );

  await writeFile(
    path.join(consumerRoot, "consumer-runtime.mjs"),
    `import { createRedactionProfile, redactText } from "${PACKAGE_NAME}";
import { redactText as redactCore } from "${PACKAGE_NAME}/core";
import { redactOpenAICompatibleRequest } from "${PACKAGE_NAME}/openai-compatible";
import { mapRedactionReportToGenAIMetadata } from "${PACKAGE_NAME}/otel";
import { withRedactedTelemetry } from "${PACKAGE_NAME}/sdk";

const rootResult = await redactText("hello@example.com");
const coreResult = await redactCore("Bearer abc.def.ghi");
const profileResult = createRedactionProfile({ builtInDetectors: ["email"] });
if (!profileResult.ok) {
  throw new Error("consumer profile creation failed");
}
const profileRedaction = await redactText("profile@example.com", {
  profile: profileResult.value,
});
const requestResult = await redactOpenAICompatibleRequest(
  { messages: [{ role: "user", content: "hello@example.com" }] },
  { profile: profileResult.value },
);
const sdkResult = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: { messages: [{ role: "user", content: "hello@example.com" }] },
  redaction: { profile: profileResult.value },
});

if (!rootResult.ok || !coreResult.ok || !profileRedaction.ok || !requestResult.ok || !sdkResult.ok) {
  throw new Error("consumer import smoke failed");
}

const metadata = mapRedactionReportToGenAIMetadata(rootResult.report);
if (metadata.attributes["genai_redactor.redaction.status"] !== "redacted") {
  throw new Error("consumer metadata smoke failed");
}
`,
  );
}

async function runNpm(args: readonly string[], cwd: string) {
  if (process.platform === "win32") {
    return execFileAsync(
      "cmd.exe",
      ["/d", "/c", "npm", ...args],
      executionOptions(cwd),
    );
  }

  return execFileAsync("npm", [...args], executionOptions(cwd));
}

async function runNode(args: readonly string[], cwd: string) {
  return execFileAsync(process.execPath, [...args], executionOptions(cwd));
}

function executionOptions(cwd: string) {
  return {
    cwd,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  };
}

function normalizeSpecifierPath(value: string) {
  return value.replaceAll("\\", "/");
}
