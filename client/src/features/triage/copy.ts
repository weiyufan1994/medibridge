import { triageCopyEn } from "@/features/triage/copy/en";
import { triageCopyZh } from "@/features/triage/copy/zh";
import type { LocalizedText } from "@shared/types";

export type TriageLang = "en" | "zh";

const INTERRUPTION_DETAIL_BY_RISK_CODE: Record<string, LocalizedText> = {
  CHEST_PAIN_BREATHING: {
    zh: "你描述的情况可能提示急性高风险问题。请立即前往急诊或呼叫当地急救服务；本平台不会继续提供 AI 分诊建议。",
    en: "Your symptoms may indicate an urgent high-risk condition. Please go to the emergency department or contact local emergency services immediately. AI triage will stop here.",
  },
  STROKE_NEURO_DEFICIT: {
    zh: "你提供的信息提示可能存在急性神经系统危险信号。请立即呼叫当地急救服务或尽快前往急诊。",
    en: "Your symptoms may suggest an acute neurological emergency. Please contact local emergency services or go to the emergency department immediately.",
  },
  MAJOR_BLEEDING: {
    zh: "你描述的症状可能提示活动性出血或其他急症。请立即前往急诊处理，本次 AI 分诊到此结束。",
    en: "Your symptoms may indicate active bleeding or another emergency. Please go to the emergency department immediately. AI triage is stopping now.",
  },
  SEIZURE_OR_LOSS_CONSCIOUSNESS: {
    zh: "你描述的情况可能属于急症。请立即联系当地急救服务或尽快前往急诊，本平台不会继续 AI 分诊。",
    en: "Your symptoms may represent a medical emergency. Please contact local emergency services or go to the emergency department immediately. AI triage will stop here.",
  },
  SEVERE_ALLERGIC_REACTION: {
    zh: "你描述的情况可能提示严重过敏反应。请立即联系当地急救服务或尽快前往急诊。",
    en: "Your symptoms may suggest a severe allergic reaction. Please contact local emergency services or go to the emergency department immediately.",
  },
  SUICIDE_SELF_HARM: {
    zh: "你提到的内容提示你可能正处于紧急心理危机中。请立即联系当地急救服务、危机干预热线，或尽快寻求身边可信任的人陪同帮助。",
    en: "Your message suggests an urgent mental health crisis. Please contact local emergency services, a crisis hotline, or seek immediate support from a trusted person near you.",
  },
  PEDIATRIC_HIGH_FEVER_ALERT: {
    zh: "婴幼儿高热需要尽快由线下医生评估。请尽快前往急诊或儿科急诊，本平台不会继续 AI 分诊。",
    en: "High fever in an infant or young child needs urgent in-person evaluation. Please go to urgent care or the emergency department as soon as possible.",
  },
  PREGNANCY_BLEEDING_ALERT: {
    zh: "妊娠期出血合并腹痛需要尽快线下评估。请尽快前往急诊或妇产科急诊。",
    en: "Bleeding with abdominal pain during pregnancy requires urgent in-person assessment. Please go to the emergency department or obstetric urgent care promptly.",
  },
} as const;

type TriageExtraction = {
  symptoms?: string;
  duration?: string;
  urgency?: "low" | "medium" | "high";
};

type TriageWhatsappMessageParams = {
  lang: TriageLang;
  doctorName: string;
  summary: string;
  extraction?: TriageExtraction;
  departmentName: string;
  reason: string;
  bookingCode: string;
};

export const TRIAGE_COPY = {
  en: triageCopyEn,
  zh: triageCopyZh,
} as const;

export const getTriageCopy = (lang: TriageLang) => TRIAGE_COPY[lang];

export const getLocalizedTriageText = (input: {
  lang: TriageLang;
  text?: LocalizedText | null;
  fallback: string;
}) => {
  if (!input.text) {
    return input.fallback;
  }

  return input.text[input.lang] || input.fallback;
};

export const getLocalizedInterruptionDetail = (input: {
  lang: TriageLang;
  message?: LocalizedText | null;
  riskCodes?: string[];
  fallback: string;
}) => {
  if (input.message) {
    return input.message[input.lang];
  }

  for (const code of input.riskCodes ?? []) {
    const localized = INTERRUPTION_DETAIL_BY_RISK_CODE[code];
    if (localized) {
      return localized[input.lang];
    }
  }

  return input.fallback;
};

export const buildTriageWhatsappMessage = ({
  lang,
  doctorName,
  summary,
  extraction,
  departmentName,
  reason,
  bookingCode,
}: TriageWhatsappMessageParams) => {
  const t = getTriageCopy(lang);

  if (lang === "zh") {
    return [
      `你好，我想预约 ${doctorName} 医生。`,
      `分诊摘要：${summary || t.bookingSummaryFallback}`,
      `症状：${extraction?.symptoms || t.bookingSymptomsFallback}`,
      `病程：${extraction?.duration || t.bookingDurationFallback}`,
      `紧急度：${extraction?.urgency || "medium"}`,
      `推荐科室：${departmentName}`,
      `推荐理由：${reason}`,
      `会话编号：#${bookingCode}`,
    ].join("\n");
  }

  return [
    `Hello, I would like to book an appointment with Dr. ${doctorName}.`,
    `AI triage summary: ${summary || t.bookingSummaryFallback}`,
    `Symptoms: ${extraction?.symptoms || t.bookingSymptomsFallback}`,
    `Duration: ${extraction?.duration || t.bookingDurationFallback}`,
    `Urgency: ${extraction?.urgency || "medium"}`,
    `Recommended department: ${departmentName}`,
    `Reason: ${reason}`,
    `Session code: #${bookingCode}`,
  ].join("\n");
};
