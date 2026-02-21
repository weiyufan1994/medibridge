import type { ResolvedLanguage } from "@/contexts/LanguageContext";

export const TRANSLATION_PLACEHOLDER = "Translation in progress";
export const MISSING_TRANSLATION_ZH = "翻译处理中";
export const MISSING_TRANSLATION = TRANSLATION_PLACEHOLDER;

const hasCjk = (value: string) => /[\u4e00-\u9fff]/.test(value);

export const getLocalizedField = ({
  lang,
  zh,
  en,
  placeholder = TRANSLATION_PLACEHOLDER,
}: {
  lang: ResolvedLanguage;
  zh?: string | null;
  en?: string | null;
  placeholder?: string;
}) => {
  if (lang === "zh") {
    return zh ?? MISSING_TRANSLATION_ZH;
  }

  if (en && !hasCjk(en)) {
    return en;
  }

  return placeholder ?? MISSING_TRANSLATION;
};

export const getSearchableText = (text: string | null | undefined) =>
  (text ?? "").toLowerCase();
