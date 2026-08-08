#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  checkArchitecture,
  collectWorkspaceFiles,
} from "./architecture-guard.mjs";
import { compareAllowlists } from "./architecture-policy.mjs";

const projectRoot = process.cwd();
const allowlistRelativePath = "scripts/architecture-allowlist.json";
const allowlistPath = path.join(projectRoot, allowlistRelativePath);
const baseRefArgumentIndex = process.argv.indexOf("--base-ref");
const requestedBaseRef =
  (baseRefArgumentIndex >= 0 ? process.argv[baseRefArgumentIndex + 1] : "") ||
  process.env.ARCHITECTURE_BASE_REF ||
  "";
const baseRef = /^0+$/.test(requestedBaseRef) ? "" : requestedBaseRef;

function readJson(source, label) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function readBaseAllowlist(ref) {
  if (!ref) return null;

  const commitCheck = spawnSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (commitCheck.status !== 0) {
    throw new Error(`architecture base ref is unavailable: ${ref}`);
  }

  const result = spawnSync("git", ["show", `${ref}:${allowlistRelativePath}`], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) return null;
  return readJson(result.stdout, `architecture allowlist at ${ref}`);
}

try {
  const allowlist = readJson(
    fs.readFileSync(allowlistPath, "utf8"),
    allowlistRelativePath
  );
  const result = checkArchitecture({
    allowlist,
    files: collectWorkspaceFiles(projectRoot),
  });
  const failures = [
    ...result.allowlistErrors,
    ...result.unexpected.map(item => `new-dependency-violation:${item}`),
    ...result.staleDependencies.map(
      item => `stale-dependency-allowlist:${item}`
    ),
    ...result.fileBudgetViolations,
    ...result.staleFileBudgets,
  ];

  const baseAllowlist = readBaseAllowlist(baseRef);
  if (baseAllowlist) {
    failures.push(...compareAllowlists(baseAllowlist, allowlist));
  }

  if (failures.length > 0) {
    console.error("Architecture check failed:");
    for (const failure of failures.sort()) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.info("Architecture check passed.");
} catch (error) {
  console.error(`Architecture check failed: ${error.message}`);
  process.exit(1);
}
