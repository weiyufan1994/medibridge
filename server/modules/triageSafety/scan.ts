import { DEFAULT_TRIAGE_RISK_RULES } from "./rules";
import type {
  RiskSeverity,
  TriageRiskRule,
  TriageRiskScanResult,
} from "./types";

const SEVERITY_PRIORITY: Record<RiskSeverity, number> = {
  critical: 3,
  high: 2,
  medium: 1,
};

const resolveHighestSeverity = (
  left: RiskSeverity | null,
  right: RiskSeverity
): RiskSeverity => {
  if (!left) return right;
  return SEVERITY_PRIORITY[right] > SEVERITY_PRIORITY[left] ? right : left;
};

const matchesRule = (rule: TriageRiskRule, haystack: string) =>
  rule.triggerGroups.every(group => group.some(pattern => pattern.test(haystack)));

export function scanMessage(input: {
  latestMessage: string;
  priorMessages?: Array<{ role: string; content: string }>;
  lang?: "zh" | "en";
}): TriageRiskScanResult {
  const priorMessageText = (input.priorMessages ?? [])
    .slice(-4)
    .map(message => message.content.trim())
    .filter(Boolean)
    .join("\n");
  const rawExcerpt = [priorMessageText, input.latestMessage.trim()].filter(Boolean).join("\n");
  const haystack = rawExcerpt.toLowerCase();

  const matched = DEFAULT_TRIAGE_RISK_RULES.filter(rule => matchesRule(rule, haystack));
  const highestSeverity = matched.reduce<RiskSeverity | null>(
    (current, rule) => resolveHighestSeverity(current, rule.severity),
    null
  );
  const recommendedAction = matched[0]?.recommendedAction ?? null;
  const displayMessage =
    matched.length === 0
      ? null
      : input.lang === "en"
        ? matched[0].userMessageEn
        : matched[0].userMessageZh;

  return {
    matchedRiskCodes: matched.map(rule => rule.riskCode),
    highestSeverity,
    shouldInterrupt: matched.some(rule => rule.interrupt),
    recommendedAction,
    displayMessage,
    triggerSource: "rule",
    rawExcerpt: rawExcerpt.slice(0, 2000),
  };
}
