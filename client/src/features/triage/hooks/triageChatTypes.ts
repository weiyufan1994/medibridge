import type { LocalizedText } from "@shared/types";
import type { TriageRouting } from "@shared/triageRouting";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type TriageResult = {
  isComplete: boolean;
  reply: string;
  interrupted?: boolean;
  riskCodes?: string[];
  interruptionMessage?: LocalizedText;
  summary?: string;
  keywords?: string[];
  routing?: TriageRouting;
  extraction?: {
    symptoms: string;
    duration: string;
    age: number | null;
    gender?: string | null;
    medicalHistory?: string | null;
    traumaOrSurgery?: string | null;
    otherSymptoms?: string | null;
    urgency: "low" | "medium" | "high";
  };
};
