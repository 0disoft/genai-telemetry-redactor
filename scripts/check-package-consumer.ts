import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  filePackageSpecifier,
  packCurrentPackage,
  verifyConsumerPackage,
} from "./package-consumer-fixture.js";

const root = process.cwd();
const tempRoot = await mkdtemp(
  path.join(tmpdir(), "genai-telemetry-redactor-consumer-"),
);

try {
  const tarballPath = await packCurrentPackage(root, tempRoot);
  await verifyConsumerPackage(
    path.join(tempRoot, "consumer"),
    filePackageSpecifier(tarballPath),
    "current tarball",
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
