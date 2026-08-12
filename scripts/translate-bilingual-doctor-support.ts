import { isFilled, sanitizeTranslatedText } from "./translate-bilingual-core";
import type { DoctorBatchTranslation } from "./translate-bilingual-parsers";

export type { DoctorBatchTranslation } from "./translate-bilingual-parsers";

export type DoctorBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  title: string | null;
  specialty: string | null;
  expertise: string | null;
  onlineConsultation: string | null;
  appointmentAvailable: string | null;
  satisfactionRate: string | null;
  attitudeScore: string | null;
};

export type DoctorSourceText = {
  sourceName: string | null;
  sourceTitle: string | null;
  sourceSpecialty: string | null;
  sourceExpertise: string | null;
  sourceOnlineConsultation: string | null;
  sourceAppointmentAvailable: string | null;
  sourceSatisfactionRate: string | null;
  sourceAttitudeScore: string | null;
};

export type DoctorTranslatedField =
  | "nameEn"
  | "titleEn"
  | "specialtyEn"
  | "expertiseEn"
  | "onlineConsultationEn"
  | "appointmentAvailableEn"
  | "satisfactionRateEn"
  | "attitudeScoreEn";

export type DoctorTranslationSnapshot = Pick<
  DoctorBatchTranslation,
  DoctorTranslatedField
>;

export type DoctorPartialInput = Partial<{
  name: string | null;
  title: string | null;
  specialty: string | null;
  expertise: string | null;
  onlineConsultation: string | null;
  appointmentAvailable: string | null;
  satisfactionRate: string | null;
  attitudeScore: string | null;
}>;

export const DOCTOR_TRANSLATION_FIELDS: Array<{
  sourceKey: keyof DoctorSourceText;
  inputKey: keyof DoctorPartialInput;
  translatedKey: DoctorTranslatedField;
}> = [
  { sourceKey: "sourceName", inputKey: "name", translatedKey: "nameEn" },
  { sourceKey: "sourceTitle", inputKey: "title", translatedKey: "titleEn" },
  {
    sourceKey: "sourceSpecialty",
    inputKey: "specialty",
    translatedKey: "specialtyEn",
  },
  {
    sourceKey: "sourceExpertise",
    inputKey: "expertise",
    translatedKey: "expertiseEn",
  },
  {
    sourceKey: "sourceOnlineConsultation",
    inputKey: "onlineConsultation",
    translatedKey: "onlineConsultationEn",
  },
  {
    sourceKey: "sourceAppointmentAvailable",
    inputKey: "appointmentAvailable",
    translatedKey: "appointmentAvailableEn",
  },
  {
    sourceKey: "sourceSatisfactionRate",
    inputKey: "satisfactionRate",
    translatedKey: "satisfactionRateEn",
  },
  {
    sourceKey: "sourceAttitudeScore",
    inputKey: "attitudeScore",
    translatedKey: "attitudeScoreEn",
  },
];

export const doctorTranslationKeys = DOCTOR_TRANSLATION_FIELDS.map(
  field => field.translatedKey
);

export const emptyDoctorTranslationSnapshot =
  (): DoctorTranslationSnapshot => ({
    nameEn: null,
    titleEn: null,
    specialtyEn: null,
    expertiseEn: null,
    onlineConsultationEn: null,
    appointmentAvailableEn: null,
    satisfactionRateEn: null,
    attitudeScoreEn: null,
  });

export const getMissingDoctorFields = (
  source: DoctorSourceText,
  translated: DoctorTranslationSnapshot
) =>
  DOCTOR_TRANSLATION_FIELDS.filter(field => {
    const sourceValue = source[field.sourceKey];
    if (!sourceValue) return false;
    return !isFilled(translated[field.translatedKey]);
  }).map(field => field.translatedKey);

export const buildDoctorPartialInput = (
  source: DoctorSourceText,
  fields: DoctorTranslatedField[]
): DoctorPartialInput => {
  const input: DoctorPartialInput = {};
  for (const field of DOCTOR_TRANSLATION_FIELDS) {
    if (!fields.includes(field.translatedKey)) continue;
    input[field.inputKey] = source[field.sourceKey];
  }
  return input;
};

export const parseDoctorPartialResponse = (
  text: string,
  fields: DoctorTranslatedField[]
): Partial<DoctorTranslationSnapshot> => {
  const parsed = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("[Doctors] Invalid partial response format");
  }

  const record = parsed as Record<string, unknown>;
  const result: Partial<DoctorTranslationSnapshot> = {};
  for (const field of fields) {
    result[field] = sanitizeTranslatedText(record[field]);
  }
  return result;
};

export const doctorTranslationIsComplete = (
  source: Omit<DoctorSourceText, "sourceName">,
  translated: DoctorTranslationSnapshot
) =>
  isFilled(translated.nameEn) &&
  (!source.sourceTitle || isFilled(translated.titleEn)) &&
  (!source.sourceSpecialty || isFilled(translated.specialtyEn)) &&
  (!source.sourceExpertise || isFilled(translated.expertiseEn)) &&
  (!source.sourceOnlineConsultation ||
    isFilled(translated.onlineConsultationEn)) &&
  (!source.sourceAppointmentAvailable ||
    isFilled(translated.appointmentAvailableEn)) &&
  (!source.sourceSatisfactionRate || isFilled(translated.satisfactionRateEn)) &&
  (!source.sourceAttitudeScore || isFilled(translated.attitudeScoreEn));
