import type { ResolvedLanguage } from "@/contexts/LanguageContext";

const mapCopyByLanguage = {
  en: {
    loadError: "The map is temporarily unavailable. Please try again later.",
  },
  zh: {
    loadError: "地图暂时无法加载，请稍后重试。",
  },
} as const;

export function getMapCopy(language: ResolvedLanguage) {
  return mapCopyByLanguage[language];
}
