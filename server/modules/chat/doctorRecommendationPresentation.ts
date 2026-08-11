import { invokeLLM } from "../../_core/llm";
import { doctorSearchApi as doctors } from "../doctors/publicApi";

export type GroundedDoctorRecommendation = {
  doctorId: number;
  reason: string;
  doctorName: string;
  hospitalName: string;
  departmentName: string;
};

export const buildDefaultRecommendationReason = (isEnglish: boolean) =>
  isEnglish
    ? "Recommended based on your symptoms and medical needs."
    : "根据您的症状与就诊需求推荐。";

const buildGroundedRecommendationMessageTemplate = (
  isEnglish: boolean,
  recommendations: GroundedDoctorRecommendation[]
) => {
  if (recommendations.length === 0) {
    return isEnglish
      ? "I currently do not have enough matched doctors in our database for your symptoms. Please provide a bit more detail, and I will continue narrowing down suitable specialists."
      : "当前数据库中暂未匹配到足够合适的医生。请补充一些症状细节，我会继续为您筛选更合适的专科医生。";
  }

  if (isEnglish) {
    const lines = recommendations.map(
      (item, index) =>
        `${index + 1}. Dr. ${item.doctorName} - ${item.hospitalName} (${item.departmentName})\nReason: ${item.reason}`
    );
    return [
      "Thanks for sharing these details. Based on your current symptoms, I found these doctors in our database:",
      ...lines,
      "If you want, I can help you decide which one to book first.",
    ].join("\n");
  }

  const lines = recommendations.map(
    (item, index) =>
      `${index + 1}. ${item.doctorName} 医生 - ${item.hospitalName}（${item.departmentName}）\n推荐理由：${item.reason}`
  );
  return [
    "收到。根据您目前描述的症状，我在数据库里筛到以下更匹配的医生：",
    ...lines,
    "如果您愿意，我可以继续帮您比较这几位医生，并给出优先预约建议。",
  ].join("\n");
};

export const buildGroundedRecommendationMessage = async (
  isEnglish: boolean,
  symptoms: string,
  recommendations: GroundedDoctorRecommendation[]
) => {
  if (recommendations.length === 0) {
    return buildGroundedRecommendationMessageTemplate(
      isEnglish,
      recommendations
    );
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: isEnglish
            ? `You are a medical triage assistant. Write a natural, empathetic chat reply.
Requirements:
1) Use ONLY the doctors/hospitals/departments provided in input JSON. Do not add or change any names.
2) Keep conversational flow like a normal AI assistant, not rigid bullet templates.
3) Briefly connect symptoms to why these doctors fit.
4) End with one concise next-step question.
5) Respond only in English.`
            : `你是医疗分诊助手。请写一段自然、有同理心的对话回复。
要求：
1）只能使用输入 JSON 里给出的医生/医院/科室，不得新增或改名；
2）语气像正常 AI 对话，不要僵硬模板；
3）简要解释这些医生与症状的匹配原因；
4）结尾给一个简洁的下一步追问；
5）仅用中文回复。`,
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              symptoms,
              recommendations,
            },
            null,
            2
          ),
        },
      ],
    });

    const text = (
      response.choices[0].message.content as string | undefined
    )?.trim();
    if (text && text.length > 0) {
      return text;
    }
  } catch (error) {
    console.warn(
      "[Chat] Failed to generate natural grounded response, falling back:",
      error
    );
  }

  return buildGroundedRecommendationMessageTemplate(isEnglish, recommendations);
};

export const buildNoMatchFollowupMessage = (isEnglish: boolean) =>
  isEnglish
    ? [
        "I don't have enough clearly matched doctors in our current database yet.",
        "To narrow it down accurately, could you share:",
        "1) where the discomfort is most obvious,",
        "2) whether you have nausea/vomiting/diarrhea or cough/phlegm/chest pain,",
        "3) whether symptoms worsen after meals, activity, or at night?",
        "Once you add these details, I can give a more precise recommendation.",
      ].join("\n")
    : [
        "目前数据库里还没有足够明确匹配的医生结果。",
        "为了更准确筛选，请再补充三点：",
        "1）不适最明显的部位；",
        "2）是否伴随恶心/呕吐/腹泻，或咳嗽/咳痰/胸痛；",
        "3）症状是否在饭后、活动后或夜间加重。",
        "您补充后，我会马上给出更精准的推荐。",
      ].join("\n");

export const buildMatchedReason = (
  isEnglish: boolean,
  result: Awaited<ReturnType<typeof doctors.search>>[number]
) => {
  if (isEnglish) {
    const departmentName = normalizePromptText(result.department.nameEn);
    const expertise = normalizePromptText(result.doctor.expertiseEn) ?? "";
    const expertiseSnippet = expertise.slice(0, 60);

    if (departmentName && expertiseSnippet.length > 0) {
      return `Your symptoms are closer to ${departmentName}. This doctor's expertise includes: ${expertiseSnippet}${expertise.length > 60 ? "..." : ""}`;
    }

    if (departmentName) {
      return `Your symptoms are aligned with ${departmentName}, so this doctor is a better fit for first consultation.`;
    }

    return buildDefaultRecommendationReason(true);
  }

  const departmentName = result.department.name;
  const rawExpertise =
    result.doctor.expertise || result.doctor.expertiseEn || "";
  const expertise = rawExpertise.replace(/\s+/g, " ").trim();
  const expertiseSnippet = expertise.length > 0 ? expertise.slice(0, 60) : "";

  if (expertiseSnippet.length > 0) {
    return `您的症状更接近${departmentName}就诊方向，该医生擅长：${expertiseSnippet}${expertise.length > 60 ? "..." : ""}`;
  }

  return `您的症状与${departmentName}方向更匹配，建议优先由该方向医生先评估。`;
};

const normalizePromptText = (
  value: string | null | undefined,
  maxLength?: number
) => {
  const normalized =
    typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

  if (normalized.length === 0) {
    return null;
  }

  if (typeof maxLength === "number") {
    return normalized.slice(0, maxLength);
  }

  return normalized;
};

export const buildEnglishRankingCandidate = (
  result: Awaited<ReturnType<typeof doctors.search>>[number],
  index: number
) => {
  const englishDisplayFields = {
    doctorName: normalizePromptText(result.doctor.nameEn),
    hospitalName: normalizePromptText(result.hospital.nameEn),
    departmentName: normalizePromptText(result.department.nameEn),
    title: normalizePromptText(result.doctor.titleEn),
    expertise: normalizePromptText(result.doctor.expertiseEn, 200),
  };

  return {
    index: index + 1,
    doctorId: result.doctor.id,
    specialty: normalizePromptText(result.doctor.specialtyEn),
    recommendationScore: result.doctor.recommendationScore ?? null,
    ...englishDisplayFields,
    missingEnglishFields: Object.entries(englishDisplayFields)
      .filter(([, value]) => value === null)
      .map(([key]) => key),
  };
};

export const getEnglishGroundedDisplayFields = (
  result: Awaited<ReturnType<typeof doctors.search>>[number]
) => {
  const doctorName = normalizePromptText(result.doctor.nameEn);
  const hospitalName = normalizePromptText(result.hospital.nameEn);
  const departmentName = normalizePromptText(result.department.nameEn);

  if (!doctorName || !hospitalName || !departmentName) {
    return null;
  }

  return {
    doctorName,
    hospitalName,
    departmentName,
  };
};
