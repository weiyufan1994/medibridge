type TriageStateSnapshot = {
  isComplete?: boolean;
} | null;

type TriageStateMessage = {
  role: "user" | "assistant";
  content: string;
};

const REPORT_GENERATION_PATTERNS = [
  /生成分诊报告/,
  /整理分诊报告/,
  /整理分诊信息/,
  /最后的分诊建议/,
  /正在整理分诊信息/,
  /triage report/i,
  /reviewing your triage details/i,
  /generate(?:d|ing)?\s+(?:a\s+|the\s+)?triage\s+(?:report|summary)/i,
  /prepare(?:d|ing)?\s+(?:a\s+|the\s+)?triage\s+(?:report|summary)/i,
];

export const isReportGenerationCue = (message: string): boolean => {
  const normalized = message.trim();
  if (!normalized) {
    return false;
  }
  return REPORT_GENERATION_PATTERNS.some(pattern => pattern.test(normalized));
};

export const shouldLockInputForReportGeneration = (params: {
  triageResult: TriageStateSnapshot;
  messages: TriageStateMessage[];
}): boolean => {
  const { triageResult, messages } = params;
  if (triageResult?.isComplete) {
    return false;
  }

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant") {
      continue;
    }
    return isReportGenerationCue(message.content);
  }

  return false;
};
