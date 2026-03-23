import type { TriageRiskRule } from "./types";

const bilingualGroup = (terms: string[]) => new RegExp(`(?:${terms.join("|")})`, "i");

export const DEFAULT_TRIAGE_RISK_RULES: TriageRiskRule[] = [
  {
    riskCode: "CHEST_PAIN_BREATHING",
    severity: "critical",
    interrupt: true,
    recommendedAction: "go_to_er",
    lang: "bilingual",
    triggerGroups: [
      [bilingualGroup(["胸痛", "胸闷", "heart pain", "chest pain", "pressure in chest"])],
      [bilingualGroup(["呼吸困难", "喘不上气", "气短", "shortness of breath", "difficulty breathing", "breathing hard"])],
    ],
    userMessageZh:
      "你描述的情况可能提示急性高风险问题。请立即前往急诊或呼叫当地急救服务；本平台不会继续提供 AI 分诊建议。",
    userMessageEn:
      "Your symptoms may indicate an urgent high-risk condition. Please go to the emergency department or contact local emergency services immediately. AI triage will stop here.",
  },
  {
    riskCode: "STROKE_NEURO_DEFICIT",
    severity: "critical",
    interrupt: true,
    recommendedAction: "call_emergency",
    lang: "bilingual",
    triggerGroups: [[
      bilingualGroup([
        "单侧无力",
        "面瘫",
        "口角歪",
        "言语不清",
        "说话含糊",
        "突发意识",
        "one-sided weakness",
        "face droop",
        "slurred speech",
        "cannot speak clearly",
        "sudden confusion",
      ]),
    ]],
    userMessageZh:
      "你提供的信息提示可能存在急性神经系统危险信号。请立即呼叫当地急救服务或尽快前往急诊。",
    userMessageEn:
      "Your symptoms may suggest an acute neurological emergency. Please contact local emergency services or go to the emergency department immediately.",
  },
  {
    riskCode: "MAJOR_BLEEDING",
    severity: "critical",
    interrupt: true,
    recommendedAction: "go_to_er",
    lang: "bilingual",
    triggerGroups: [[
      bilingualGroup([
        "大出血",
        "吐血",
        "咯血",
        "黑便",
        "鲜血不止",
        "major bleeding",
        "vomiting blood",
        "coughing blood",
        "black stool",
        "passing blood",
      ]),
    ]],
    userMessageZh:
      "你描述的症状可能提示活动性出血或其他急症。请立即前往急诊处理，本次 AI 分诊到此结束。",
    userMessageEn:
      "Your symptoms may indicate active bleeding or another emergency. Please go to the emergency department immediately. AI triage is stopping now.",
  },
  {
    riskCode: "SEIZURE_OR_LOSS_CONSCIOUSNESS",
    severity: "critical",
    interrupt: true,
    recommendedAction: "call_emergency",
    lang: "bilingual",
    triggerGroups: [[
      bilingualGroup([
        "抽搐",
        "昏厥",
        "意识丧失",
        "晕倒",
        "seizure",
        "fainted",
        "passed out",
        "loss of consciousness",
      ]),
    ]],
    userMessageZh:
      "你描述的情况可能属于急症。请立即联系当地急救服务或尽快前往急诊，本平台不会继续 AI 分诊。",
    userMessageEn:
      "Your symptoms may represent a medical emergency. Please contact local emergency services or go to the emergency department immediately. AI triage will stop here.",
  },
  {
    riskCode: "SEVERE_ALLERGIC_REACTION",
    severity: "critical",
    interrupt: true,
    recommendedAction: "call_emergency",
    lang: "bilingual",
    triggerGroups: [
      [bilingualGroup(["过敏", "allergic", "allergy"])],
      [bilingualGroup(["呼吸困难", "喉头紧", "喘不上气", "throat closing", "difficulty breathing", "swollen tongue"])],
    ],
    userMessageZh:
      "你描述的情况可能提示严重过敏反应。请立即联系当地急救服务或尽快前往急诊。",
    userMessageEn:
      "Your symptoms may suggest a severe allergic reaction. Please contact local emergency services or go to the emergency department immediately.",
  },
  {
    riskCode: "SUICIDE_SELF_HARM",
    severity: "critical",
    interrupt: true,
    recommendedAction: "mental_health_hotline",
    lang: "bilingual",
    triggerGroups: [[
      bilingualGroup([
        "自杀",
        "轻生",
        "不想活",
        "伤害自己",
        "自残",
        "kill myself",
        "suicide",
        "hurt myself",
        "self harm",
        "don't want to live",
      ]),
    ]],
    userMessageZh:
      "你提到的内容提示你可能正处于紧急心理危机中。请立即联系当地急救服务、危机干预热线，或尽快寻求身边可信任的人陪同帮助。",
    userMessageEn:
      "Your message suggests an urgent mental health crisis. Please contact local emergency services, a crisis hotline, or seek immediate support from a trusted person near you.",
  },
  {
    riskCode: "PEDIATRIC_HIGH_FEVER_ALERT",
    severity: "high",
    interrupt: true,
    recommendedAction: "seek_urgent_care",
    lang: "bilingual",
    triggerGroups: [
      [bilingualGroup(["婴儿", "幼儿", "宝宝", "infant", "baby", "toddler", "newborn"])],
      [bilingualGroup(["高热", "发烧 39", "发烧39", "持续发烧", "high fever", "fever above 39", "persistent fever"])],
    ],
    userMessageZh:
      "婴幼儿高热需要尽快由线下医生评估。请尽快前往急诊或儿科急诊，本平台不会继续 AI 分诊。",
    userMessageEn:
      "High fever in an infant or young child needs urgent in-person evaluation. Please go to urgent care or the emergency department as soon as possible.",
  },
  {
    riskCode: "PREGNANCY_BLEEDING_ALERT",
    severity: "high",
    interrupt: true,
    recommendedAction: "seek_urgent_care",
    lang: "bilingual",
    triggerGroups: [
      [bilingualGroup(["怀孕", "孕", "pregnant", "pregnancy"])],
      [bilingualGroup(["出血", "流血", "bleeding", "spotting"])],
      [bilingualGroup(["腹痛", "肚子痛", "abdominal pain", "cramping"])],
    ],
    userMessageZh:
      "妊娠期出血合并腹痛需要尽快线下评估。请尽快前往急诊或妇产科急诊。",
    userMessageEn:
      "Bleeding with abdominal pain during pregnancy requires urgent in-person assessment. Please go to the emergency department or obstetric urgent care promptly.",
  },
];
