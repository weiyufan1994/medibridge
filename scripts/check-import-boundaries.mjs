#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  checkArchitecture,
  collectWorkspaceFiles,
} from "./architecture-guard.mjs";
import { createArchitectureBaseline } from "./architecture-baseline.mjs";

const projectRoot = process.cwd();
const allowlistPath = path.join(
  projectRoot,
  "scripts",
  "architecture-allowlist.json"
);
const files = collectWorkspaceFiles(projectRoot);

if (process.argv.includes("--print-baseline")) {
  console.info(JSON.stringify(createArchitectureBaseline(files), null, 2));
  process.exit(0);
}

const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const result = checkArchitecture({ allowlist, files });
const failures = [
  ...result.unexpected.map(item => `new dependency violation: ${item}`),
  ...result.stale.map(item => `stale dependency allowlist entry: ${item}`),
  ...result.fileBudgetViolations,
];

if (failures.length > 0) {
  console.error("Architecture check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.info("Architecture check passed.");
