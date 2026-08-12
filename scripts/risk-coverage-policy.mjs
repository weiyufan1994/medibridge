import path from "node:path";

export const REQUIRED_CHANGED_LINE_COVERAGE = 80;
export const REQUIRED_HIGH_RISK_LINE_COVERAGE = 90;

export const CLEANUP_BATCHES = Object.freeze({
  auth: "1-auth-session-cookie-permissions",
  payments: "2-payments-refunds-webhooks",
  appointments: "3-appointment-state-token-visit",
  medical: "4-medical-summary-ai-triage-safety",
  workers: "5-workers",
});

const CORE_AUTH_FILES = new Set([
  "server/_core/context.ts",
  "server/_core/cookies.ts",
  "server/_core/httpMiddleware.ts",
  "server/_core/oauth.ts",
  "server/_core/trpc.ts",
]);

const APPOINTMENT_SECURITY_FILE =
  /\/(?:access|chatPolicy|lifecycle|sessionTransition|state|status|token|visitIntegration)[^/]*\.ts$/;

const PAYMENT_FILE = /\/(?:[^/]*(?:payment|refund|webhook)[^/]*)\.ts$/i;

export function isApplicationSource(relativePath) {
  return (
    /^(?:client\/src|server|shared)\//.test(relativePath) &&
    /\.[cm]?[jt]sx?$/.test(relativePath) &&
    !/\.(?:test|spec|test-setup|test-utils)\.[cm]?[jt]sx?$/.test(
      relativePath
    ) &&
    !relativePath.endsWith(".d.ts")
  );
}

export function normalizeCoveragePath(filePath, projectRoot) {
  return path.relative(projectRoot, filePath).split(path.sep).join("/");
}

export function classifyHighRiskFile(relativePath) {
  if (!isApplicationSource(relativePath)) return null;

  if (
    relativePath.startsWith("server/modules/auth/") ||
    relativePath.startsWith("server/workflows/authGuestUpgrade/") ||
    CORE_AUTH_FILES.has(relativePath) ||
    relativePath === "server/routers/auth.ts" ||
    relativePath === "server/modules/ai/sessionAccessActions.ts" ||
    relativePath === "server/modules/ai/historicalTriageAccessActions.ts" ||
    relativePath === "server/modules/doctorAccounts/accessActions.ts" ||
    relativePath.endsWith("/accessControl.ts")
  ) {
    return CLEANUP_BATCHES.auth;
  }

  if (
    relativePath.startsWith("server/modules/payments/") ||
    relativePath.startsWith("server/workflows/appointmentPayments/") ||
    relativePath === "server/modules/appointments/checkoutActions.ts" ||
    relativePath === "server/routers/referrals.ts" ||
    (relativePath.startsWith("server/") && PAYMENT_FILE.test(relativePath))
  ) {
    return CLEANUP_BATCHES.payments;
  }

  if (
    relativePath === "server/_core/appointmentToken.ts" ||
    relativePath.startsWith("server/modules/visit/") ||
    relativePath.startsWith("server/workflows/appointmentBooking/") ||
    relativePath === "server/modules/admin/procedures/appointmentActions.ts" ||
    relativePath === "server/modules/admin/procedures/appointmentDetail.ts" ||
    relativePath === "server/routers/appointments.ts" ||
    relativePath === "server/routers/visit.ts" ||
    (relativePath.startsWith("server/modules/appointments/") &&
      APPOINTMENT_SECURITY_FILE.test(relativePath))
  ) {
    return CLEANUP_BATCHES.appointments;
  }

  if (
    relativePath.startsWith("server/modules/triageSafety/") ||
    relativePath.startsWith("server/workflows/appointmentMedicalSummary/") ||
    relativePath === "server/modules/admin/visitSummary.ts" ||
    relativePath === "server/modules/admin/visitSummaryRepo.ts" ||
    relativePath === "server/modules/admin/procedures/visitSummaries.ts" ||
    relativePath === "server/modules/ai/actions.ts" ||
    (relativePath.startsWith("server/modules/appointments/") &&
      /\/medicalSummary[^/]*\.ts$/.test(relativePath))
  ) {
    return CLEANUP_BATCHES.medical;
  }

  if (
    relativePath.startsWith("server/workers/") ||
    relativePath.startsWith("server/workflows/appointmentAutoClose/") ||
    /Worker\.ts$/.test(relativePath)
  ) {
    return CLEANUP_BATCHES.workers;
  }

  return null;
}

export function getLineHits(fileCoverage) {
  const lineHits = new Map();

  for (const [statementId, hits] of Object.entries(fileCoverage.s ?? {})) {
    const line = fileCoverage.statementMap?.[statementId]?.start?.line;
    if (!Number.isInteger(line)) continue;
    lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
  }

  return lineHits;
}

export function summarizeLines(lineHits, selectedLines = null) {
  const entries = selectedLines
    ? [...lineHits].filter(([line]) => selectedLines.has(line))
    : [...lineHits];
  const total = entries.length;
  const covered = entries.filter(([, hits]) => hits > 0).length;
  const percentage = total === 0 ? 100 : (covered / total) * 100;

  return { covered, total, percentage };
}

export function parseChangedLines(diff) {
  const changed = new Map();
  let currentFile = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice(6);
      if (!changed.has(currentFile)) changed.set(currentFile, new Set());
      continue;
    }

    if (!currentFile || !line.startsWith("@@")) continue;
    const match = /\+(\d+)(?:,(\d+))?/.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    const lines = changed.get(currentFile);
    for (let offset = 0; offset < count; offset += 1) {
      lines.add(start + offset);
    }
  }

  return changed;
}

function isExactSourcePath(file) {
  return (
    typeof file === "string" &&
    !path.isAbsolute(file) &&
    !file.includes("..") &&
    !/[!*?{}[\]]/.test(file) &&
    isApplicationSource(file)
  );
}

export function validateCoveragePolicy(policy) {
  const failures = [];
  if (policy.changedLinesMinimum !== REQUIRED_CHANGED_LINE_COVERAGE) {
    failures.push(
      `changedLinesMinimum must be ${REQUIRED_CHANGED_LINE_COVERAGE}`
    );
  }
  if (policy.highRiskLinesTarget !== REQUIRED_HIGH_RISK_LINE_COVERAGE) {
    failures.push(
      `highRiskLinesTarget must be ${REQUIRED_HIGH_RISK_LINE_COVERAGE}`
    );
  }
  if (!Array.isArray(policy.exceptions)) {
    return [...failures, "exceptions must be an array"];
  }

  const seen = new Set();
  for (const exception of policy.exceptions) {
    if (!isExactSourcePath(exception.file)) {
      failures.push(
        `exception must use an exact server source path: ${exception.file}`
      );
      continue;
    }
    if (seen.has(exception.file))
      failures.push(`duplicate exception: ${exception.file}`);
    seen.add(exception.file);
    if (classifyHighRiskFile(exception.file) !== exception.cleanupBatch) {
      failures.push(`incorrect cleanup batch: ${exception.file}`);
    }
    if (
      typeof exception.currentLineCoverage !== "number" ||
      exception.currentLineCoverage < 0 ||
      exception.currentLineCoverage >= REQUIRED_HIGH_RISK_LINE_COVERAGE
    ) {
      failures.push(`invalid current coverage: ${exception.file}`);
    }
    if (exception.targetLineCoverage !== REQUIRED_HIGH_RISK_LINE_COVERAGE) {
      failures.push(`invalid target coverage: ${exception.file}`);
    }
  }

  return failures;
}

export function compareCoverageExceptions(basePolicy, currentPolicy) {
  if (!basePolicy) return [];
  const current = new Map(
    currentPolicy.exceptions.map(item => [item.file, item])
  );
  const base = new Map(basePolicy.exceptions.map(item => [item.file, item]));
  const failures = [];

  for (const [file, exception] of current) {
    const previous = base.get(file);
    if (!previous) {
      failures.push(`new coverage exception is forbidden: ${file}`);
      continue;
    }
    if (exception.cleanupBatch !== previous.cleanupBatch) {
      failures.push(`coverage exception batch is immutable: ${file}`);
    }
    if (exception.targetLineCoverage !== previous.targetLineCoverage) {
      failures.push(`coverage exception target is immutable: ${file}`);
    }
    if (exception.currentLineCoverage < previous.currentLineCoverage) {
      failures.push(`coverage exception baseline cannot decrease: ${file}`);
    }
  }

  return failures;
}
