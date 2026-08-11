import { z } from "zod";
import {
  buildLightTriageResultFormDefaults,
  type TriageRouting,
} from "../../../shared/triageRouting";
import {
  getLocalizedTriageGenderLabel,
  type TriageIntakeGender,
} from "../../../shared/triageIntake";
import { buildHospitalRouting } from "./hospitalRouting";
import { createLogger } from "../../_core/logger";
import type { TriageCollectedData } from "./triageLogic";
import type { TriageLang, TriageResponse } from "./service";

const logger = createLogger("ai-triage-history");

export const TRIAGE_RESULT_FLAG_TYPE = "triage_result_v1";

const localizedTextSchema = z.object({
  zh: z.string(),
  en: z.string(),
});

const triageRoutingHospitalSchema = z.object({
  hospitalName: z.string(),
  city: z.string().nullable(),
  specialtyRank: z.number().nullable(),
  specialtyScore: z.number().nullable(),
  generalGrade: z.string().nullable(),
  stemRank: z.number().nullable(),
  matchedHospitalId: z.number().nullable(),
  matchedDepartmentId: z.number().nullable(),
  reason: z.string(),
});

const triageRoutingSchema = z.object({
  possibilitySummary: z.string(),
  recommendedDepartment: z.object({
    zh: z.string(),
    en: z.string(),
    matchedSpecialtyKey: z.string().nullable(),
  }),
  hospitals: z.array(triageRoutingHospitalSchema),
  confidence: z.enum(["standard", "reduced"]).optional().default("standard"),
  missingCriticalFields: z
    .array(z.enum(["age", "gender"]))
    .optional()
    .default([]),
});

export const historicalTriageResultSchema = z.object({
  isComplete: z.boolean(),
  reply: z.string(),
  interrupted: z.boolean().optional(),
  riskCodes: z.array(z.string()).optional(),
  interruptionMessage: localizedTextSchema.optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  routing: triageRoutingSchema.optional(),
  extraction: z
    .object({
      symptoms: z.string(),
      duration: z.string(),
      age: z.number().nullable(),
      gender: z.string().nullable().optional(),
      medicalHistory: z.string().nullable().optional(),
      traumaOrSurgery: z.string().nullable().optional(),
      otherSymptoms: z.string().nullable().optional(),
      urgency: z.enum(["low", "medium", "high"]),
    })
    .optional(),
});

export type HistoricalTriageResult = z.infer<
  typeof historicalTriageResultSchema
>;

const normalizeText = (value: string | null | undefined) => value?.trim() ?? "";

const detectSummaryLanguage = (summary: string): TriageLang =>
  /[\u4e00-\u9fff]/.test(summary) ? "zh" : "en";

function parseAgeGender(value: string): {
  age: number | null;
  gender: TriageIntakeGender;
} {
  const normalized = value.trim();
  const ageMatch = normalized.match(/\b(\d{1,3})\b/);
  const age = ageMatch ? Number(ageMatch[1]) : null;
  const lowered = normalized.toLowerCase();

  if (/(^|[\s/])男($|[\s/])/.test(normalized) || /\bmale\b/.test(lowered)) {
    return { age: Number.isFinite(age) ? age : null, gender: "male" };
  }
  if (/(^|[\s/])女($|[\s/])/.test(normalized) || /\bfemale\b/.test(lowered)) {
    return { age: Number.isFinite(age) ? age : null, gender: "female" };
  }
  if (/其他/.test(normalized) || /\bother\b/.test(lowered)) {
    return { age: Number.isFinite(age) ? age : null, gender: "other" };
  }

  return {
    age: Number.isFinite(age) ? age : null,
    gender: "unknown",
  };
}

function buildHistoricalExtraction(input: {
  data: TriageCollectedData;
  lang: TriageLang;
}): HistoricalTriageResult["extraction"] {
  return {
    symptoms: input.data.mainSymptomAndLocation,
    duration: input.data.durationAndOnset,
    age: input.data.age,
    gender:
      input.data.gender === "unknown"
        ? null
        : getLocalizedTriageGenderLabel(input.data.gender, input.lang),
    medicalHistory: input.data.chronicConditions || null,
    traumaOrSurgery: input.data.traumaOrSurgery || null,
    otherSymptoms: input.data.otherSymptoms || null,
    urgency: input.data.urgency,
  };
}

export function parseStoredHistoricalTriageResult(
  value: string | null | undefined
): HistoricalTriageResult | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    const result = historicalTriageResultSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export async function rebuildHistoricalTriageResultFromSummary(
  summary: string | null | undefined
): Promise<HistoricalTriageResult | null> {
  const normalizedSummary = normalizeText(summary);
  if (!normalizedSummary) {
    return null;
  }

  const lang = detectSummaryLanguage(normalizedSummary);
  const form = buildLightTriageResultFormDefaults({
    summary: normalizedSummary,
  });
  const demographics = parseAgeGender(form.ageGender);
  const data: TriageCollectedData = {
    mainSymptomAndLocation: normalizeText(form.mainSymptomAndLocation),
    durationAndOnset: normalizeText(form.durationAndOnset),
    traumaOrSurgery: normalizeText(form.traumaOrSurgery),
    chronicConditions: normalizeText(form.medicalHistory),
    otherSymptoms: normalizeText(form.otherSymptoms),
    age: demographics.age,
    gender: demographics.gender,
    urgency: "medium",
  };

  const hasCoreDetail =
    data.mainSymptomAndLocation.length > 0 || data.durationAndOnset.length > 0;
  if (!hasCoreDetail) {
    return {
      isComplete: true,
      reply: "",
      summary: normalizedSummary,
      extraction: buildHistoricalExtraction({ data, lang }),
    };
  }

  let routing: TriageRouting | undefined;
  try {
    routing = await buildHospitalRouting({
      data,
      lang,
    });
  } catch (error) {
    logger.warn("routing_rebuild_failed", {
      lang,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return {
    isComplete: true,
    reply: "",
    summary: normalizedSummary,
    routing,
    extraction: buildHistoricalExtraction({ data, lang }),
  };
}

export function serializeHistoricalTriageResult(
  triageResult: HistoricalTriageResult | TriageResponse
): string {
  return JSON.stringify({
    ...triageResult,
  });
}
