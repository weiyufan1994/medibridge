import type { ResolvedLanguage } from "@/contexts/LanguageContext";
import {
  MISSING_TRANSLATION,
  MISSING_TRANSLATION_ZH,
  getLocalizedText,
  getSearchableText,
} from "@/lib/i18n";
import type { LocalizedText } from "@shared/types";

type HospitalsLang = ResolvedLanguage;

const SHANGHAI_CITY_VALUES = new Set(["shanghai", "上海"]);
const PLACEHOLDER_BY_LANG = {
  en: MISSING_TRANSLATION,
  zh: MISSING_TRANSLATION_ZH,
} as const;

export function buildHospitalsListInput(lang: HospitalsLang) {
  return { lang } as const;
}

export function buildHospitalDepartmentsInput(
  hospitalId: number,
  lang: HospitalsLang
) {
  return { hospitalId, lang } as const;
}

export function buildDepartmentDoctorsInput(
  departmentId: number,
  lang: HospitalsLang,
  limit: number = 50
) {
  return { departmentId, limit, lang } as const;
}

export function buildDoctorDetailInput(doctorId: number, lang: HospitalsLang) {
  return { id: doctorId, lang } as const;
}

export function getHospitalBrowseText(input: {
  lang: HospitalsLang;
  value?: LocalizedText | null;
}) {
  return getLocalizedText({
    lang: input.lang,
    value: input.value,
    placeholder: PLACEHOLDER_BY_LANG[input.lang],
  });
}

export function isHospitalBrowsePlaceholder(value: string) {
  return value === MISSING_TRANSLATION || value === MISSING_TRANSLATION_ZH;
}

function normalizeText(value: string | null | undefined) {
  return getSearchableText(value).trim();
}

export function matchesHospitalCityFilter(input: {
  city?: LocalizedText | null;
  filter: string;
}) {
  const normalizedFilter = normalizeText(input.filter);
  if (!normalizedFilter || normalizedFilter === "all") {
    return true;
  }

  const cityValues = [input.city?.zh, input.city?.en]
    .map(value => normalizeText(value))
    .filter(Boolean);

  if (SHANGHAI_CITY_VALUES.has(normalizedFilter)) {
    return cityValues.some(value => SHANGHAI_CITY_VALUES.has(value));
  }

  return cityValues.includes(normalizedFilter);
}
