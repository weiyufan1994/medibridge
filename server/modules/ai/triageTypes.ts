import type { TriageIntakeGender } from "../../../shared/triageIntake";
import type {
  TriageRoutingConfidence,
  TriageRoutingCriticalField,
} from "../../../shared/triageRouting";

export type TriageExtractionDraft = {
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  chronicConditions: string;
  otherSymptoms: string;
  age: number | null;
  gender: TriageIntakeGender | null;
  urgency: "low" | "medium" | "high";
};

export type TriageCollectedData = {
  mainSymptomAndLocation: string;
  durationAndOnset: string;
  traumaOrSurgery: string;
  chronicConditions: string;
  otherSymptoms: string;
  age: number | null;
  gender: TriageIntakeGender;
  urgency: "low" | "medium" | "high";
};

export type TriageDepartmentHint = {
  key: string;
  zh: string;
  en: string;
};

export type TriageDepartmentRecommendation = {
  department: TriageDepartmentHint;
  confidence: TriageRoutingConfidence;
  missingCriticalFields: TriageRoutingCriticalField[];
};

export type MissingTriageField =
  | "mainSymptomAndLocation"
  | "durationAndOnset"
  | "traumaOrSurgery"
  | "chronicConditions"
  | "age"
  | "gender";
