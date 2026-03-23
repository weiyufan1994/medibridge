import type { ResolvedLanguage } from "@/contexts/LanguageContext";
import type { LocalizedText } from "@shared/types";

export const TRANSLATION_PLACEHOLDER = "Translation in progress";
export const MISSING_TRANSLATION_ZH = "翻译处理中";
export const MISSING_TRANSLATION = TRANSLATION_PLACEHOLDER;

const hasCjk = (value: string) => /[\u4e00-\u9fff]/.test(value);
const DISPLAY_LOCALE_BY_LANGUAGE = {
  en: "en-US",
  zh: "zh-CN",
} as const;

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
  return {
    zh: zh ?? MISSING_TRANSLATION_ZH,
    en: en && !hasCjk(en) ? en : placeholder ?? MISSING_TRANSLATION,
  }[lang];
};

export const getSearchableText = (text: string | null | undefined) =>
  (text ?? "").toLowerCase();

export const getDisplayLocale = (lang: ResolvedLanguage): "en-US" | "zh-CN" =>
  DISPLAY_LOCALE_BY_LANGUAGE[lang];

export const getLocalizedText = ({
  lang,
  value,
  placeholder = TRANSLATION_PLACEHOLDER,
}: {
  lang: ResolvedLanguage;
  value?: LocalizedText | null;
  placeholder?: string;
}) => {
  if (!value) {
    return placeholder;
  }

  return getLocalizedField({
    lang,
    zh: value.zh,
    en: value.en,
    placeholder,
  });
};

export const getLocalizedTextWithZhFallback = ({
  lang,
  value,
  placeholder = "",
}: {
  lang: ResolvedLanguage;
  value?: LocalizedText | null;
  placeholder?: string;
}) =>
  getLocalizedText({
    lang,
    value,
    placeholder: value?.zh ?? placeholder,
  });
