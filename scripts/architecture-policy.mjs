const REMEDIATION_PHASES = new Set(["4", "5", "6"]);

function hasWildcard(value) {
  return /[*?\[\]]/.test(value);
}

export function validateAllowlist(allowlist) {
  const errors = [];
  for (const [violation, metadata] of Object.entries(
    allowlist.dependencyViolations ?? {}
  )) {
    if (hasWildcard(violation)) errors.push(`allowlist-wildcard:${violation}`);
    if (!REMEDIATION_PHASES.has(metadata?.phase)) {
      errors.push(`allowlist-invalid-phase:${violation}`);
    }
    if (typeof metadata?.reason !== "string" || !metadata.reason.trim()) {
      errors.push(`allowlist-missing-reason:${violation}`);
    }
  }

  for (const [filePath, metadata] of Object.entries(
    allowlist.fileBudgets ?? {}
  )) {
    if (hasWildcard(filePath)) errors.push(`file-budget-wildcard:${filePath}`);
    if (!Number.isInteger(metadata?.maxLines) || metadata.maxLines <= 400) {
      errors.push(`file-budget-invalid-limit:${filePath}`);
    }
    if (!REMEDIATION_PHASES.has(metadata?.phase)) {
      errors.push(`file-budget-invalid-phase:${filePath}`);
    }
    if (typeof metadata?.reason !== "string" || !metadata.reason.trim()) {
      errors.push(`file-budget-missing-reason:${filePath}`);
    }
  }
  return errors.sort();
}

export function compareAllowlists(base, current) {
  const failures = [];
  const baseDependencies = base.dependencyViolations ?? {};
  const currentDependencies = current.dependencyViolations ?? {};
  for (const [key, metadata] of Object.entries(currentDependencies)) {
    if (!baseDependencies[key]) failures.push(`allowlist-added:${key}`);
    else if (
      metadata.phase !== baseDependencies[key].phase ||
      metadata.reason !== baseDependencies[key].reason
    ) {
      failures.push(`allowlist-metadata-changed:${key}`);
    }
  }

  const baseBudgets = base.fileBudgets ?? {};
  const currentBudgets = current.fileBudgets ?? {};
  for (const [filePath, metadata] of Object.entries(currentBudgets)) {
    const baseMetadata = baseBudgets[filePath];
    if (!baseMetadata) failures.push(`file-budget-added:${filePath}`);
    else {
      if (metadata.maxLines > baseMetadata.maxLines) {
        failures.push(`file-budget-increased:${filePath}`);
      }
      if (
        metadata.phase !== baseMetadata.phase ||
        metadata.reason !== baseMetadata.reason
      ) {
        failures.push(`file-budget-metadata-changed:${filePath}`);
      }
    }
  }
  return failures.sort();
}
