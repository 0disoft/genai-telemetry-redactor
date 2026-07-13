import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  filePackageSpecifier,
  packCurrentPackage,
  PACKAGE_NAME,
  verifyConsumerPackage,
} from "./package-consumer-fixture.js";

type Baseline = {
  schemaVersion?: string;
  package?: string;
  version?: string;
};

const BASELINE_SCHEMA = "genai-telemetry-redactor/compatibility-baseline/v1";
const root = process.cwd();
const baseline = JSON.parse(
  await readFile(
    path.join(root, "scripts", "compatibility-baseline.json"),
    "utf8",
  ),
) as Baseline;
validateBaseline(baseline);

const currentArgument = argumentValue("--current");
const tempRoot = await mkdtemp(
  path.join(tmpdir(), "genai-telemetry-redactor-compatibility-"),
);

try {
  await verifyConsumerPackage(
    path.join(tempRoot, "baseline"),
    baseline.version,
    `baseline ${baseline.version}`,
    2,
  );

  let currentSpecifier = currentArgument;
  if (!currentSpecifier) {
    const tarballPath = await packCurrentPackage(root, tempRoot);
    currentSpecifier = filePackageSpecifier(tarballPath);
  }
  await verifyConsumerPackage(
    path.join(tempRoot, "current"),
    currentSpecifier,
    currentArgument
      ? `published ${PACKAGE_NAME}@${currentArgument}`
      : "current tarball",
    currentArgument ? 3 : 1,
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

function validateBaseline(
  value: Baseline,
): asserts value is Required<Baseline> {
  if (
    value.schemaVersion !== BASELINE_SCHEMA ||
    value.package !== PACKAGE_NAME ||
    !value.version ||
    !/^\d+\.\d+\.\d+$/.test(value.version)
  ) {
    throw new Error("compatibility baseline configuration is invalid");
  }
}

function argumentValue(name: string) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a package version`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${name} must be an exact package version`);
  }
  return value;
}
