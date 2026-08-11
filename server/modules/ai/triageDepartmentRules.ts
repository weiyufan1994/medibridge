import type { TriageDepartmentHint } from "./triageTypes";

export const POSITIVE_TRAUMA_PATTERNS = [
  /外伤/,
  /摔伤/,
  /扭伤/,
  /撞伤/,
  /切割伤/,
  /手术/,
  /术后/,
  /\binjury\b/i,
  /\btrauma\b/i,
  /\bfall\b/i,
  /\bcut\b/i,
  /\bsurgery\b/i,
  /\bpost-?op\b/i,
];

export const PEDIATRIC_PATTERNS = [
  /儿科/,
  /儿童/,
  /小孩/,
  /宝宝/,
  /婴儿/,
  /\bpediatric\b/i,
  /\bchild\b/i,
  /\bchildren\b/i,
  /\binfant\b/i,
];

export const GYNECOLOGY_PATTERNS = [
  /月经/,
  /经期/,
  /痛经/,
  /阴道/,
  /妇科/,
  /产科/,
  /怀孕/,
  /妊娠/,
  /\bmenstrual\b/i,
  /\bperiod\b/i,
  /\bvaginal\b/i,
  /\bpregnan/i,
  /\bgyne/i,
  /\bobstet/i,
];

export const SPECIALTY_HINTS = [
  {
    key: "cardiology",
    patterns: [
      /胸痛/,
      /心悸/,
      /胸闷/,
      /高血压/,
      /\bheart\b/i,
      /\bcardio/i,
      /\bpalpitation/i,
      /\bchest pain\b/i,
    ],
    zh: "心内科",
    en: "cardiology",
  },
  {
    key: "respiratory",
    patterns: [
      /咳嗽/,
      /咳痰/,
      /气短/,
      /呼吸困难/,
      /\bcough\b/i,
      /\bphlegm\b/i,
      /\basthma\b/i,
      /\brespirat/i,
      /\bpulmon/i,
    ],
    zh: "呼吸科",
    en: "respiratory medicine",
  },
  {
    key: "digestive",
    patterns: [
      /腹痛/,
      /胃/,
      /腹泻/,
      /呕吐/,
      /反酸/,
      /\babdominal\b/i,
      /\bstomach\b/i,
      /\bgastro/i,
      /\bvomi/i,
      /\bdiarr/i,
    ],
    zh: "消化内科",
    en: "gastroenterology",
  },
  {
    key: "dermatology",
    patterns: [
      /皮肤/,
      /皮疹/,
      /瘙痒/,
      /湿疹/,
      /\brash\b/i,
      /\bitch/i,
      /\beczema\b/i,
      /\bdermat/i,
    ],
    zh: "皮肤科",
    en: "dermatology",
  },
  {
    key: "neurology",
    patterns: [
      /头痛/,
      /头晕/,
      /麻木/,
      /偏头痛/,
      /\bheadache\b/i,
      /\bdizz/i,
      /\bnumb/i,
      /\bmigraine\b/i,
      /\bneurolog/i,
    ],
    zh: "神经内科",
    en: "neurology",
  },
  {
    key: "orthopedics",
    patterns: [
      /关节/,
      /膝/,
      /骨折/,
      /骨/,
      /扭伤/,
      /\bknee\b/i,
      /\bjoint\b/i,
      /\bfracture\b/i,
      /\borthop/i,
      /\btrauma\b/i,
    ],
    zh: "骨科",
    en: "orthopedics",
  },
  {
    key: "gynecology",
    patterns: GYNECOLOGY_PATTERNS,
    zh: "妇科",
    en: "gynecology",
  },
  {
    key: "pediatrics",
    patterns: PEDIATRIC_PATTERNS,
    zh: "儿科",
    en: "pediatrics",
  },
];

export const KNOWLEDGE_TAG_LABELS: Record<string, TriageDepartmentHint> = {
  musculoskeletal: {
    key: "orthopedics",
    zh: "骨科",
    en: "orthopedics",
  },
  trauma_fracture: {
    key: "orthopedics",
    zh: "创伤骨科",
    en: "orthopedic trauma",
  },
  oral_maxillofacial: {
    key: "oral",
    zh: "口腔颌面外科",
    en: "oral and maxillofacial surgery",
  },
  rheumatology: {
    key: "rheumatology",
    zh: "风湿免疫科",
    en: "rheumatology",
  },
  sports_medicine: {
    key: "sports_medicine",
    zh: "运动医学",
    en: "sports medicine",
  },
  neurology: {
    key: "neurology",
    zh: "神经内科",
    en: "neurology",
  },
  digestive: {
    key: "digestive",
    zh: "消化内科",
    en: "gastroenterology",
  },
  respiratory: {
    key: "respiratory",
    zh: "呼吸科",
    en: "respiratory medicine",
  },
  cardiology: {
    key: "cardiology",
    zh: "心内科",
    en: "cardiology",
  },
  gynecology: {
    key: "gynecology",
    zh: "妇科",
    en: "gynecology",
  },
  pediatrics: {
    key: "pediatrics",
    zh: "儿科",
    en: "pediatrics",
  },
  dermatology: {
    key: "dermatology",
    zh: "皮肤科",
    en: "dermatology",
  },
  general_medicine: {
    key: "general_medicine",
    zh: "全科",
    en: "general medicine",
  },
} as const;

export const GENERAL_MEDICINE_HINT: TriageDepartmentHint = {
  key: "general_medicine",
  zh: "全科",
  en: "general medicine",
};

export const PEDIATRICS_HINT: TriageDepartmentHint = {
  key: "pediatrics",
  zh: "儿科",
  en: "pediatrics",
};
