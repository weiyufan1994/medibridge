import type { ResolvedLanguage } from "@/contexts/LanguageContext";
import { getLocalizedText } from "@/lib/i18n";
import type { LocalizedText } from "@shared/types";

export function getAppointmentSurfaceText(input: {
  lang: ResolvedLanguage;
  value?: LocalizedText | null;
  fallback: string;
}) {
  return getLocalizedText({
    lang: input.lang,
    value: input.value,
    placeholder: input.fallback,
  });
}
