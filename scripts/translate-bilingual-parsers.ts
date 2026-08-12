import { sanitizeTranslatedText } from "./translate-bilingual-core";

export type HospitalBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  cityEn: string | null;
  levelEn: string | null;
  addressEn: string | null;
  descriptionEn: string | null;
};

export const parseHospitalBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Hospitals] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, HospitalBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const sourceHash =
      typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id =
      typeof item.id === "number"
        ? item.id
        : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      cityEn: sanitizeTranslatedText(item.cityEn),
      levelEn: sanitizeTranslatedText(item.levelEn),
      addressEn: sanitizeTranslatedText(item.addressEn),
      descriptionEn: sanitizeTranslatedText(item.descriptionEn),
    });
  }

  return { items: results, invalidEntries };
};

export type DepartmentBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  descriptionEn: string | null;
};

export const parseDepartmentBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Departments] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, DepartmentBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const sourceHash =
      typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id =
      typeof item.id === "number"
        ? item.id
        : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      descriptionEn: sanitizeTranslatedText(item.descriptionEn),
    });
  }

  return { items: results, invalidEntries };
};

export type DoctorBatchTranslation = {
  id: number;
  sourceHash: string;
  nameEn: string | null;
  titleEn: string | null;
  specialtyEn: string | null;
  expertiseEn: string | null;
  onlineConsultationEn: string | null;
  appointmentAvailableEn: string | null;
  satisfactionRateEn: string | null;
  attitudeScoreEn: string | null;
};

export const parseDoctorBatchResponse = (text: string) => {
  const parsed = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !Array.isArray((parsed as { items?: unknown }).items)
  ) {
    throw new Error("[Doctors] Invalid batch response format");
  }

  const items = (parsed as { items: unknown[] }).items;
  const results = new Map<string, DoctorBatchTranslation>();
  let invalidEntries = 0;

  for (const rawItem of items) {
    if (!rawItem || typeof rawItem !== "object") {
      invalidEntries += 1;
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const sourceHash =
      typeof item.sourceHash === "string" ? item.sourceHash.trim() : "";
    const id =
      typeof item.id === "number"
        ? item.id
        : Number.parseInt(String(item.id), 10);
    if (!sourceHash || !Number.isFinite(id) || id <= 0) {
      invalidEntries += 1;
      continue;
    }

    results.set(sourceHash, {
      id,
      sourceHash,
      nameEn: sanitizeTranslatedText(item.nameEn),
      titleEn: sanitizeTranslatedText(item.titleEn),
      specialtyEn: sanitizeTranslatedText(item.specialtyEn),
      expertiseEn: sanitizeTranslatedText(item.expertiseEn),
      onlineConsultationEn: sanitizeTranslatedText(item.onlineConsultationEn),
      appointmentAvailableEn: sanitizeTranslatedText(
        item.appointmentAvailableEn
      ),
      satisfactionRateEn: sanitizeTranslatedText(item.satisfactionRateEn),
      attitudeScoreEn: sanitizeTranslatedText(item.attitudeScoreEn),
    });
  }

  return { items: results, invalidEntries };
};
