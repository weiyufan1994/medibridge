#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ALLOWED_ENV_TEMPLATES = new Set([
  ".env.example",
  ".env.production.example",
]);
const PRIVATE_KEY_MARKER = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/;
const CLIENT_SECRET_NAME = /\bVITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN)[A-Z0-9_]*\b/;
const RETIRED_MAP_PATHS = new Set(["server/_core/map.ts"]);
const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const RETIRED_MAP_MARKER = new RegExp(
  [
    ["VITE", "FRONTEND", "FORGE", "API", "KEY"].join("_"),
    ["FORGE", "MAPS", "PROXY", "API", "KEY"].join("_"),
    ["FORGE", "MAPS", "PROXY", "BASE", "URL"].join("_"),
    ["", "api", "maps", "script"].join("/"),
    ["", "v1", "maps", "proxy"].join("/"),
  ]
    .map(escapeRegExp)
    .join("|")
);
const SOURCE_FILE = /\.(?:cjs|js|jsx|mjs|ts|tsx)$/;

function listTrackedFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    {
      encoding: "buffer",
    }
  );

  if (result.status !== 0) {
    const message = result.stderr.toString("utf8").trim();
    throw new Error(message || "Unable to list tracked files");
  }

  return result.stdout.toString("utf8").split("\0").filter(Boolean);
}

function isTrackedEnvFile(filePath) {
  const fileName = filePath.split("/").at(-1) ?? filePath;
  return fileName.startsWith(".env") && !ALLOWED_ENV_TEMPLATES.has(fileName);
}

function readTextFile(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.includes(0)) {
    return null;
  }
  return buffer.toString("utf8");
}

export function collectFileViolations(filePath, source) {
  const violations = [];

  if (isTrackedEnvFile(filePath)) {
    return [`${filePath}: tracked environment file`];
  }
  if (RETIRED_MAP_PATHS.has(filePath)) {
    return [`${filePath}: retired map capability`];
  }
  if (source === null) {
    return violations;
  }

  if (PRIVATE_KEY_MARKER.test(source)) {
    violations.push(`${filePath}: private key marker`);
  }
  if (CLIENT_SECRET_NAME.test(source)) {
    violations.push(`${filePath}: secret-shaped VITE_ variable`);
  }
  if (SOURCE_FILE.test(filePath) && RETIRED_MAP_MARKER.test(source)) {
    violations.push(`${filePath}: retired map capability marker`);
  }

  return violations;
}

function collectViolations(files) {
  const violations = [];

  for (const filePath of files) {
    if (!existsSync(filePath)) {
      continue;
    }
    violations.push(...collectFileViolations(filePath, readTextFile(filePath)));
  }

  return violations;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const violations = collectViolations(listTrackedFiles());
  if (violations.length > 0) {
    console.error("Secret check failed:");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.info("Secret check passed.");
}
