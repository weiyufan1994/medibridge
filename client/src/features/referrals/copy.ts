import { referralCopyEn } from "@/features/referrals/copy/en";
import { referralCopyZh } from "@/features/referrals/copy/zh";

export type ReferralLang = "en" | "zh";

const referralCopyByLang = {
  en: referralCopyEn,
  zh: referralCopyZh,
} as const;

export function getReferralCopy(lang: ReferralLang) {
  return referralCopyByLang[lang];
}
