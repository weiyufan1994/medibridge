export type AppointmentIntake = {
  chiefComplaint: string;
  duration: string;
  medicalHistory: string;
  medications: string;
  allergies: string;
  ageGroup: string;
  otherSymptoms: string;
};

export type TriageExtractionPrefill = {
  symptoms?: string | null;
  duration?: string | null;
  age?: number | null;
  medicalHistory?: string | null;
  medications?: string | null;
  allergies?: string | null;
  otherSymptoms?: string | null;
};

export type TriagePrefillInput = {
  summary?: string | null;
  extraction?: TriageExtractionPrefill | null;
};

export const EMPTY_APPOINTMENT_INTAKE: AppointmentIntake = {
  chiefComplaint: "",
  duration: "",
  medicalHistory: "",
  medications: "",
  allergies: "",
  ageGroup: "",
  otherSymptoms: "",
};

const SUMMARY_ALIAS_MAP: Record<string, keyof AppointmentIntake> = {
  "chief complaint": "chiefComplaint",
  complaint: "chiefComplaint",
  "main complaint": "chiefComplaint",
  主诉: "chiefComplaint",
  duration: "duration",
  持续时间: "duration",
  "medical history": "medicalHistory",
  history: "medicalHistory",
  既往史: "medicalHistory",
  "medication history": "medications",
  medications: "medications",
  meds: "medications",
  用药史: "medications",
  "allergy history": "allergies",
  allergies: "allergies",
  过敏史: "allergies",
  age: "ageGroup",
  "age group": "ageGroup",
  年龄段: "ageGroup",
  "other symptoms": "otherSymptoms",
  "associated symptoms": "otherSymptoms",
  其他症状: "otherSymptoms",
};

function parseSummaryToIntake(summary: string): Partial<AppointmentIntake> {
  const result: Partial<AppointmentIntake> = {};
  const chunks = summary
    .split(/[;；]/)
    .map(chunk => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const match = chunk.match(/^([^:：]+)\s*[:：]\s*(.+)$/);
    if (!match) {
      continue;
    }

    const label = match[1].trim();
    const value = match[2].trim();
    if (!value) {
      continue;
    }

    const key = SUMMARY_ALIAS_MAP[label.toLowerCase()] ?? SUMMARY_ALIAS_MAP[label];
    if (!key || result[key]) {
      continue;
    }
    result[key] = value;
  }

  return result;
}

export function buildIntakeDefaultsFromTriage(
  input: TriagePrefillInput | undefined
): AppointmentIntake {
  if (!input) {
    return { ...EMPTY_APPOINTMENT_INTAKE };
  }

  const parsed = input.summary?.trim()
    ? parseSummaryToIntake(input.summary.trim())
    : {};
  const symptoms = input.extraction?.symptoms?.trim() ?? "";
  const duration = input.extraction?.duration?.trim() ?? "";
  const age =
    typeof input.extraction?.age === "number" && Number.isFinite(input.extraction.age)
      ? String(input.extraction.age)
      : "";
  const extractionMedicalHistory = input.extraction?.medicalHistory?.trim() ?? "";
  const extractionMedications = input.extraction?.medications?.trim() ?? "";
  const extractionAllergies = input.extraction?.allergies?.trim() ?? "";
  const extractionOtherSymptoms = input.extraction?.otherSymptoms?.trim() ?? "";

  return {
    ...EMPTY_APPOINTMENT_INTAKE,
    ...parsed,
    chiefComplaint: symptoms || parsed.chiefComplaint || "",
    duration: duration || parsed.duration || "",
    ageGroup: parsed.ageGroup || age,
    medicalHistory: extractionMedicalHistory || parsed.medicalHistory || "",
    medications: extractionMedications || parsed.medications || "",
    allergies: extractionAllergies || parsed.allergies || "",
    otherSymptoms: extractionOtherSymptoms || parsed.otherSymptoms || "",
  };
}
