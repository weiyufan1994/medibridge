#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  REQUIRED_CHANGED_LINE_COVERAGE,
  REQUIRED_HIGH_RISK_LINE_COVERAGE,
  classifyHighRiskFile,
  compareCoverageExceptions,
  getLineHits,
  isApplicationSource,
  normalizeCoveragePath,
  parseChangedLines,
  summarizeLines,
  validateCoveragePolicy,
} from "./risk-coverage-policy.mjs";

const projectRoot = process.cwd();
const policyRelativePath = "scripts/risk-coverage-baseline.json";
const coveragePath = path.join(projectRoot, "coverage/coverage-final.json");
const policyPath = path.join(projectRoot, policyRelativePath);

function readJson(source, label) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

function runGit(args) {
  return spawnSync("git", args, {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

function resolveBaseRef() {
  const requested = process.env.COVERAGE_BASE_REF ?? "";
  if (requested && !/^0+$/.test(requested)) return requested;

  const remoteDev = runGit(["rev-parse", "--verify", "origin/dev"]);
  if (remoteDev.status === 0) return remoteDev.stdout.trim();

  const parent = runGit(["rev-parse", "HEAD^"]);
  return parent.status === 0 ? parent.stdout.trim() : "";
}

function readBasePolicy(baseRef) {
  if (!baseRef) return null;
  const result = runGit(["show", `${baseRef}:${policyRelativePath}`]);
  if (result.status !== 0) return null;
  return readJson(result.stdout, `risk coverage baseline at ${baseRef}`);
}

function readChangedLines(baseRef) {
  if (!baseRef) return new Map();
  const result = runGit([
    "diff",
    "--unified=0",
    "--no-ext-diff",
    "--diff-filter=AM",
    baseRef,
    "--",
    "client/src",
    "server",
    "shared",
  ]);
  if (result.status !== 0) {
    throw new Error(
      `cannot read changed lines from ${baseRef}: ${result.stderr}`
    );
  }
  return parseChangedLines(result.stdout);
}

function buildCoverageIndex(rawCoverage) {
  return new Map(
    Object.entries(rawCoverage).map(([filePath, coverage]) => [
      normalizeCoveragePath(filePath, projectRoot),
      getLineHits(coverage),
    ])
  );
}

function roundPercentage(value) {
  return Number(value.toFixed(2));
}

function formatCoverage(summary) {
  return `${roundPercentage(summary.percentage)}% (${summary.covered}/${summary.total})`;
}

function checkHighRiskCoverage(policy, coverageIndex) {
  const failures = [];
  const exceptionIndex = new Map(
    policy.exceptions.map(exception => [exception.file, exception])
  );
  const highRiskFiles = [...coverageIndex]
    .map(([file]) => file)
    .filter(file => classifyHighRiskFile(file));
  const highRiskFileSet = new Set(highRiskFiles);

  for (const file of highRiskFiles) {
    const summary = summarizeLines(coverageIndex.get(file));
    const exception = exceptionIndex.get(file);
    if (summary.percentage >= REQUIRED_HIGH_RISK_LINE_COVERAGE) {
      if (exception) failures.push(`stale coverage exception: ${file}`);
      continue;
    }
    if (!exception) {
      failures.push(
        `high-risk coverage below ${REQUIRED_HIGH_RISK_LINE_COVERAGE}% without an exception: ${file} (${formatCoverage(summary)})`
      );
      continue;
    }
    if (roundPercentage(summary.percentage) < exception.currentLineCoverage) {
      failures.push(
        `high-risk coverage regressed below baseline: ${file} (${formatCoverage(summary)} < ${exception.currentLineCoverage}%)`
      );
    }
  }

  for (const file of exceptionIndex.keys()) {
    if (!fs.existsSync(path.join(projectRoot, file))) {
      failures.push(`baseline file does not exist: ${file}`);
    } else if (!highRiskFileSet.has(file)) {
      failures.push(`coverage report is missing baseline file: ${file}`);
    }
  }

  const unreportedHighRiskFiles = [];
  fs.globSync("server/*.ts", { cwd: projectRoot }).forEach(file => {
    if (classifyHighRiskFile(file) && !highRiskFileSet.has(file)) {
      unreportedHighRiskFiles.push(file);
    }
  });
  for (const directory of [
    "server/_core",
    "server/modules",
    "server/workflows",
  ]) {
    fs.globSync(`${directory}/**/*.ts`, { cwd: projectRoot }).forEach(file => {
      if (classifyHighRiskFile(file) && !highRiskFileSet.has(file)) {
        unreportedHighRiskFiles.push(file);
      }
    });
  }
  for (const file of unreportedHighRiskFiles) {
    failures.push(`high-risk source is missing from coverage: ${file}`);
  }

  return { failures, highRiskCount: highRiskFiles.length };
}

function checkChangedCoverage(changedLines, coverageIndex) {
  let covered = 0;
  let total = 0;
  const uncoveredFiles = [];

  for (const [file, lines] of changedLines) {
    if (!isApplicationSource(file)) continue;
    const lineHits = coverageIndex.get(file);
    if (!lineHits) {
      uncoveredFiles.push(file);
      continue;
    }
    const summary = summarizeLines(lineHits, lines);
    covered += summary.covered;
    total += summary.total;
  }

  const failures = uncoveredFiles.map(
    file => `changed application file is missing from coverage: ${file}`
  );
  const summary = {
    covered,
    total,
    percentage: total === 0 ? 100 : (covered / total) * 100,
  };
  if (summary.percentage < REQUIRED_CHANGED_LINE_COVERAGE) {
    failures.push(
      `changed executable line coverage is ${formatCoverage(summary)}; required ${REQUIRED_CHANGED_LINE_COVERAGE}%`
    );
  }

  return { failures, summary };
}

try {
  const coverage = readJson(
    fs.readFileSync(coveragePath, "utf8"),
    "coverage report"
  );
  const policy = readJson(
    fs.readFileSync(policyPath, "utf8"),
    policyRelativePath
  );
  const baseRef = resolveBaseRef();
  const basePolicy = readBasePolicy(baseRef);
  const coverageIndex = buildCoverageIndex(coverage);
  const changedLines = readChangedLines(baseRef);
  const highRisk = checkHighRiskCoverage(policy, coverageIndex);
  const changed = checkChangedCoverage(changedLines, coverageIndex);
  const failures = [
    ...validateCoveragePolicy(policy),
    ...compareCoverageExceptions(basePolicy, policy),
    ...highRisk.failures,
    ...changed.failures,
  ];

  if (failures.length > 0) {
    console.error("Risk coverage check failed:");
    for (const failure of failures.sort()) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.info(
    `Risk coverage check passed: ${highRisk.highRiskCount} high-risk files checked; changed executable lines ${formatCoverage(changed.summary)}.`
  );
} catch (error) {
  console.error(`Risk coverage check failed: ${error.message}`);
  process.exit(1);
}
