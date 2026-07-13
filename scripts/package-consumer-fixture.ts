import { execFile } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

type PackResult = {
  filename?: string;
};

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

export const PACKAGE_NAME = "genai-telemetry-redactor";

export async function packCurrentPackage(
  repositoryRoot: string,
  destination: string,
) {
  const { stdout } = await runNpm(
    ["pack", "--json", "--ignore-scripts", "--pack-destination", destination],
    repositoryRoot,
  );
  const parsed = JSON.parse(stdout) as PackResult[];
  const [packResult] = parsed;
  if (parsed.length !== 1 || !packResult) {
    throw new Error(`npm pack returned ${parsed.length} artifacts`);
  }

  const tarballs = (await readdir(destination))
    .filter((entry) => entry.endsWith(".tgz"))
    .sort((left, right) => left.localeCompare(right));
  const [tarballName] = tarballs;
  if (tarballs.length !== 1 || !tarballName) {
    throw new Error(
      `expected one packed tarball in compatibility workspace, found ${tarballs.length}`,
    );
  }

  const packedFilename = packResult.filename
    ? path.basename(packResult.filename)
    : tarballName;
  if (packedFilename !== tarballName) {
    throw new Error("npm pack filename did not match the emitted tarball");
  }

  return path.join(destination, tarballName);
}

export function filePackageSpecifier(tarballPath: string) {
  return `file:${tarballPath.replaceAll("\\", "/")}`;
}

export async function verifyConsumerPackage(
  consumerRoot: string,
  packageSpecifier: string,
  label: string,
  installAttempts = 1,
) {
  await writeConsumerProject(consumerRoot, packageSpecifier);
  await installConsumer(consumerRoot, installAttempts);
  await runNode([tscPath, "--project", "tsconfig.json"], consumerRoot);
  await runNode(["consumer-runtime.mjs"], consumerRoot);
  console.log(`Compatibility consumer passed: ${label}`);
}

async function installConsumer(consumerRoot: string, attempts: number) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      await runNpm(
        ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
        consumerRoot,
      );
      return;
    } catch (error) {
      lastError = error;
      await rm(path.join(consumerRoot, "node_modules"), {
        recursive: true,
        force: true,
      });
      await rm(path.join(consumerRoot, "package-lock.json"), { force: true });
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  throw new Error("consumer dependency installation failed", {
    cause: lastError,
  });
}

async function writeConsumerProject(
  consumerRoot: string,
  packageSpecifier: string,
) {
  await mkdir(consumerRoot, { recursive: true });
  await writeFile(
    path.join(consumerRoot, "package.json"),
    `${JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          [PACKAGE_NAME]: packageSpecifier,
        },
      },
      null,
      2,
    )}\n`,
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

const rootResult: RedactionResult<string> = await redactText("user@example.invalid");
const coreResult: RedactionResult<string> = await redactCore("safe input");
const profileResult: RedactionProfileCreationResult = createRedactionProfile({
  builtInDetectors: ["email"],
});
if (profileResult.ok) {
  await redactText("profile@example.invalid", { profile: profileResult.value });
  const profileOperation: OpenAICompatibleRedactionOptions = {
    profile: profileResult.value,
  };
  await redactOpenAICompatibleRequest(
    { prompt: "adapter@example.invalid" },
    profileOperation,
  );
  await withRedactedTelemetry({
    adapter: "openai-compatible",
    request: { prompt: "sdk@example.invalid" },
    redaction: profileOperation,
  });
}
const requestResult = await redactOpenAICompatibleRequest({
  messages: [{ role: "user", content: "user@example.invalid" }],
});
if (rootResult.ok) {
  mapRedactionReportToGenAIMetadata(rootResult.report, {
    operationName: "chat",
    providerName: "openai-compatible",
  });
}
const sdkResult: WithRedactedTelemetryResult = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: { messages: [{ role: "user", content: "user@example.invalid" }] },
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

const rootResult = await redactText("user@example.invalid");
const coreResult = await redactCore("safe input");
const profileResult = createRedactionProfile({ builtInDetectors: ["email"] });
if (!profileResult.ok) {
  throw new Error("consumer profile creation failed");
}
const profileRedaction = await redactText("profile@example.invalid", {
  profile: profileResult.value,
});
const requestResult = await redactOpenAICompatibleRequest(
  { messages: [{ role: "user", content: "user@example.invalid" }] },
  { profile: profileResult.value },
);
const sdkResult = await withRedactedTelemetry({
  adapter: "openai-compatible",
  request: { messages: [{ role: "user", content: "user@example.invalid" }] },
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
  return runExecutable(
    process.platform === "win32" ? "npm.cmd" : "npm",
    args,
    cwd,
  );
}

async function runNode(args: readonly string[], cwd: string) {
  return runExecutable(
    process.platform === "win32" ? "node.exe" : "node",
    args,
    cwd,
  );
}

async function runExecutable(
  executable: string,
  args: readonly string[],
  cwd: string,
) {
  const env = { ...process.env };
  delete env.npm_config_manage_package_manager_versions;
  delete env.NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS;
  return execFileAsync(executable, [...args], {
    cwd,
    env,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 10,
  });
}
