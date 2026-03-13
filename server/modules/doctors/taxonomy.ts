export const DOCTOR_SPECIALTY_TAGS = [
  "musculoskeletal",
  "rheumatology",
  "sports_medicine",
  "neurology",
  "digestive",
  "respiratory",
  "cardiology",
  "gynecology",
  "pediatrics",
  "dermatology",
  "general_medicine",
] as const;

export type DoctorSpecialtyTag = (typeof DOCTOR_SPECIALTY_TAGS)[number];

type TagRule = {
  tag: DoctorSpecialtyTag;
  keywords: string[];
};

const TAG_RULES: TagRule[] = [
  {
    tag: "musculoskeletal",
    keywords: ["骨科", "关节", "膝", "膝盖", "膝关节", "半月板", "韧带", "创伤", "骨", "orthop", "joint", "knee"],
  },
  {
    tag: "rheumatology",
    keywords: ["风湿", "类风湿", "痛风", "免疫", "rheumat"],
  },
  {
    tag: "sports_medicine",
    keywords: ["运动医学", "运动损伤", "sports medicine", "sports injury"],
  },
  {
    tag: "neurology",
    keywords: ["神经", "偏头痛", "头痛", "头晕", "麻木", "脑", "neurolog", "migraine", "stroke"],
  },
  {
    tag: "digestive",
    keywords: ["消化", "胃", "胃肠", "腹痛", "腹泻", "便秘", "gastro", "digestive", "stomach"],
  },
  {
    tag: "respiratory",
    keywords: ["呼吸", "肺", "咳嗽", "哮喘", "呼吸困难", "respirat", "pulmon", "cough", "asthma"],
  },
  {
    tag: "cardiology",
    keywords: ["心内", "心血管", "心脏", "胸痛", "心悸", "cardio", "heart", "palpitation"],
  },
  {
    tag: "gynecology",
    keywords: ["妇科", "产科", "卵巢", "子宫", "月经", "gyne", "obstet", "uterus", "ovary"],
  },
  {
    tag: "pediatrics",
    keywords: ["儿科", "儿童", "小儿", "婴儿", "pediatric", "children", "infant"],
  },
  {
    tag: "dermatology",
    keywords: ["皮肤", "皮疹", "湿疹", "痤疮", "瘙痒", "dermat", "rash", "eczema"],
  },
  {
    tag: "general_medicine",
    keywords: ["全科", "综合", "内科", "general", "family medicine", "internal medicine"],
  },
];

function normalizeText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

export function deriveDoctorSpecialtyTags(input: {
  departmentName?: string | null;
  departmentNameEn?: string | null;
  specialty?: string | null;
  specialtyEn?: string | null;
  expertise?: string | null;
  expertiseEn?: string | null;
}) {
  const haystack = normalizeText([
    input.departmentName,
    input.departmentNameEn,
    input.specialty,
    input.specialtyEn,
    input.expertise,
    input.expertiseEn,
  ]);

  const tags = TAG_RULES.filter(rule =>
    rule.keywords.some(keyword => haystack.includes(keyword.toLowerCase()))
  ).map(rule => rule.tag);

  return Array.from(new Set(tags));
}
