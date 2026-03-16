export type RiskSeverity = "critical" | "high" | "medium";

export type RiskAction =
  | "go_to_er"
  | "call_emergency"
  | "seek_urgent_care"
  | "book_doctor"
  | "mental_health_hotline";

export type TriageRiskRule = {
  riskCode: string;
  severity: RiskSeverity;
  interrupt: boolean;
  recommendedAction: RiskAction;
  lang: "bilingual";
  triggerGroups: RegExp[][];
  userMessageZh: string;
  userMessageEn: string;
};

export type TriageRiskMatch = {
  riskCode: string;
  severity: RiskSeverity;
  recommendedAction: RiskAction;
};

export type TriageRiskScanResult = {
  matchedRiskCodes: string[];
  highestSeverity: RiskSeverity | null;
  shouldInterrupt: boolean;
  recommendedAction: RiskAction | null;
  displayMessage: string | null;
  triggerSource: "rule";
  rawExcerpt: string;
};
