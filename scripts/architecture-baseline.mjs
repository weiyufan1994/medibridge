import { analyzeArchitecture } from "./architecture-guard.mjs";

function phaseForViolation(violation) {
  if (violation.startsWith("feature-") || violation.startsWith("page-")) {
    return "5";
  }
  return "4";
}

function phaseForFile(filePath) {
  if (filePath.startsWith("client/")) {
    return "5";
  }
  if (filePath.startsWith("scripts/")) {
    return "6";
  }
  return "4";
}

export function createArchitectureBaseline(files) {
  const dependencyViolations = Object.fromEntries(
    analyzeArchitecture(files).map(violation => [
      violation,
      {
        phase: phaseForViolation(violation),
        reason: "Existing dependency to remove in the assigned hardening phase",
      },
    ])
  );
  const fileBudgets = Object.fromEntries(
    files
      .map(file => [file, file.source.split("\n").length])
      .filter(([, lineCount]) => lineCount > 400)
      .sort(([left], [right]) => left.path.localeCompare(right.path))
      .map(([file, lineCount]) => [
        file.path,
        {
          maxLines: lineCount,
          phase: phaseForFile(file.path),
          reason:
            "Existing oversized file; edits may not increase this ceiling",
        },
      ])
  );
  return { dependencyViolations, fileBudgets };
}
