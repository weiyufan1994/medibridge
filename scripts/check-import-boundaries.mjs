#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const featuresDir = path.join(projectRoot, "client", "src", "features");

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (!fullPath.endsWith(".ts") && !fullPath.endsWith(".tsx")) {
      continue;
    }

    files.push(fullPath);
  }

  return files;
}

function normalizeImportFrom(raw) {
  return raw;
}

function checkFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const importPattern = /(?:import|export)\s+[^'"`]+?\s+from\s+['"]([^'"]+)['"]/g;
  const matches = [];
  let match;

  while ((match = importPattern.exec(source)) !== null) {
    const importPath = normalizeImportFrom(match[1]);
    if (importPath === "@/pages" || importPath.startsWith("@/pages/")) {
      matches.push(importPath);
    }
  }

  return matches;
}

if (!fs.existsSync(featuresDir)) {
  process.exit(0);
}

const featureFiles = collectFiles(featuresDir);
const violations = [];

for (const file of featureFiles) {
  const badImports = checkFile(file);
  if (badImports.length === 0) continue;

  violations.push(
    `${path.relative(projectRoot, file)} imports pages: ${badImports.map(value => `"${value}"`).join(", ")}`
  );
}

if (violations.length > 0) {
  console.error("Import boundary check failed: features must not import pages.");
  for (const item of violations) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

process.exit(0);
