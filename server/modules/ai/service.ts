import type { InvokeResult } from "../../_core/llm";
import { invokeLLM } from "../../_core/llm";
import type {
  TriageIntake,
  TriageIntakeGender,
} from "../../../shared/triageIntake";
import type { TriageRouting } from "../../../shared/triageRouting";
import {
  hasStructuredTriageInput,
  normalizeTriageIntake,
} from "../../../shared/triageIntake";
import {
  buildCompletionReply,
  buildFollowupReply,
  buildRecommendationKeywords,
  buildTriageExtractionOutput,
  buildTriageSummary,
  coerceMissingFieldsForCompletion,
  listMissingTriageFields,
  mergeTriageData,
  resolveRecommendedDepartment,
  type TriageExtractionDraft,
} from "./triageLogic";
import { buildHospitalRouting } from "./hospitalRouting";

export type TriageChatMessage = {
  role: string;
  content: string;
};

export interface TriageResponse {
  isComplete: boolean;
  reply: string;
  summary?: string;
  keywords?: string[];
  routing?: TriageRouting;
  extraction?: {
    symptoms: string;
    duration: string;
    age: number | null;
    gender?: string | null;
    medicalHistory?: string | null;
    traumaOrSurgery?: string | null;
    otherSymptoms?: string | null;
    urgency: "low" | "medium" | "high";
  };
}

export type TriageLang = "en" | "zh";
export type TriageKnowledgeContext = {
  snippets: Array<{
    title: string;
    content: string;
    riskCodes: string[];
    specialtyTags: string[];
  }>;
};

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

const TRIAGE_EXTRACTION_SCHEMA: JsonSchema = {
  name: "triage_extraction",
  strict: true,
  schema: {
    type: "object",
    properties: {
      mainSymptomAndLocation: { type: "string", maxLength: 300 },
      durationAndOnset: { type: "string", maxLength: 160 },
      traumaOrSurgery: { type: "string", maxLength: 200 },
      chronicConditions: { type: "string", maxLength: 200 },
      otherSymptoms: { type: "string", maxLength: 200 },
      age: { type: ["number", "null"] },
      gender: {
        anyOf: [
          {
            type: "string",
            enum: ["male", "female", "other", "unknown"],
          },
          { type: "null" },
        ],
      },
      urgency: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: [
      "mainSymptomAndLocation",
      "durationAndOnset",
      "traumaOrSurgery",
      "chronicConditions",
      "otherSymptoms",
      "age",
      "gender",
      "urgency",
    ],
    additionalProperties: false,
  },
};

const TRIAGE_TEMPLATE_GUIDANCE_ZH = `对话模板顺序（用于理解患者表达，不是让你输出模板）：
1. 核心症状与部位：例如“右下腹痛”“胸闷”“腿部皮肤破损”
2. 发病时间与急缓：例如“今天早上突然出现”“3 天来逐渐加重”“2 个月反复发作”
3. 外伤与手术史：例如“无”“昨天摔伤”“近期做过手术”
4. 关键基础疾病：例如“无”“糖尿病”“高血压或心脏病”
年龄和性别是补充信息，不是默认首轮阻塞项。`;

const TRIAGE_TEMPLATE_GUIDANCE_EN = `Conversation template order for understanding patient descriptions:
1. Main symptom and location: e.g. "right lower abdominal pain", "chest tightness", "skin wound on the leg"
2. Duration and onset: e.g. "started suddenly this morning", "worsening over 3 days", "recurring for 2 months"
3. Trauma or surgery history: e.g. "none", "fell yesterday", "had surgery recently"
4. Key underlying conditions: e.g. "none", "diabetes", "high blood pressure or heart disease"
Age and gender are supporting details, not default first-turn blockers.`;

const TRIAGE_EXTRACTION_PROMPT_ZH = `你是 MediBridge 的极速分诊信息抽取器。
任务：根据“AI 主动引导后的对话记录”提取关键信息，供后续规则判断是否已经可以完成分诊并推荐专科/医院。

输出要求：
1) 只返回 JSON，不要输出解释。
2) 文本字段必须使用中文。
3) 若某项没有被明确提到，返回空字符串；年龄未知返回 null；性别未知返回 "unknown"。
4) 不要编造诊断，不要补全用户没说过的事实。
5) urgency 仅返回 low / medium / high。
6) 对话可能会附带兼容模式下的结构化 intake；如果有，用它补充事实，但优先忠实于患者真实表达。

字段定义：
- mainSymptomAndLocation：核心症状与具体部位
- durationAndOnset：发病时间与急缓
- traumaOrSurgery：是否与外伤或近期手术有关；若明确否认，请保留“无/没有”
- chronicConditions：关键基础疾病；若明确否认，请保留“无/没有”
- otherSymptoms：其他伴随症状
- age：数字或 null
- gender：male / female / other / unknown

${TRIAGE_TEMPLATE_GUIDANCE_ZH}`;

const TRIAGE_EXTRACTION_PROMPT_EN = `You are MediBridge's fast-triage fact extractor.
Task: extract structured triage facts from an AI-guided conversation so the server can decide whether triage is complete and ready for department/hospital routing.

Output rules:
1) Return JSON only.
2) Keep all text fields in English.
3) If a fact was not explicitly provided, return an empty string. Use null for unknown age and "unknown" for unknown gender.
4) Do not invent diagnoses or fill in missing facts.
5) urgency must be low / medium / high.
6) The payload may include an optional compatibility intake object; use it only to preserve explicitly stated facts.

Field definitions:
- mainSymptomAndLocation: main symptom and exact body location
- durationAndOnset: duration and onset pattern
- traumaOrSurgery: relation to trauma or recent surgery; preserve explicit negatives like "none"
- chronicConditions: key chronic conditions; preserve explicit negatives like "none"
- otherSymptoms: associated symptoms
- age: number or null
- gender: male / female / other / unknown

${TRIAGE_TEMPLATE_GUIDANCE_EN}`;

const TRIAGE_FALLBACK_REPLY_ZH =
  "如果方便，请先告诉我年龄和性别。然后我们按 4 个问题来：1. 现在最主要的不适是什么，具体在哪个部位？2. 这个症状出现多久了，是突然发生还是逐渐加重/反复发作？3. 这次不适和外伤或近期手术有没有关系？4. 有没有需要特别注意的基础疾病，比如糖尿病、高血压或心脏病、免疫系统疾病或肿瘤？没有可直接写“无”。";
const TRIAGE_FALLBACK_REPLY_EN =
  "If you are comfortable, please start with your age and gender. Then let's go through 4 quick questions: 1. What is the main symptom, and where is it located? 2. How long has it been happening, and did it start suddenly or gradually? 3. Is it related to any recent injury or surgery? 4. Do you have any important underlying conditions, such as diabetes, high blood pressure, heart disease, immune disorders, or cancer? If something does not apply, write \"none\".";

const extractAssistantText = (
  content: InvokeResult["choices"][number]["message"]["content"] | undefined
): string => {
  if (!content) return "";
  if (typeof content === "string") return content.trim();

  return content
    .filter(part => part.type === "text")
    .map(part => part.text)
    .join("\n")
    .trim();
};

const normalizeGender = (value: unknown): TriageIntakeGender | null => {
  if (
    value === "male" ||
    value === "female" ||
    value === "other" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
};

const parseExtractionDraft = (
  rawContent: string
): TriageExtractionDraft | null => {
  const parseObject = (payload: unknown): TriageExtractionDraft | null => {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const obj = payload as Record<string, unknown>;
    const urgency =
      obj.urgency === "low" ||
      obj.urgency === "medium" ||
      obj.urgency === "high"
        ? obj.urgency
        : null;

    if (!urgency) {
      return null;
    }

    return {
      mainSymptomAndLocation:
        typeof obj.mainSymptomAndLocation === "string"
          ? obj.mainSymptomAndLocation.trim().slice(0, 300)
          : "",
      durationAndOnset:
        typeof obj.durationAndOnset === "string"
          ? obj.durationAndOnset.trim().slice(0, 160)
          : "",
      traumaOrSurgery:
        typeof obj.traumaOrSurgery === "string"
          ? obj.traumaOrSurgery.trim().slice(0, 200)
          : "",
      chronicConditions:
        typeof obj.chronicConditions === "string"
          ? obj.chronicConditions.trim().slice(0, 200)
          : "",
      otherSymptoms:
        typeof obj.otherSymptoms === "string"
          ? obj.otherSymptoms.trim().slice(0, 200)
          : "",
      age:
        typeof obj.age === "number" && Number.isFinite(obj.age)
          ? Math.trunc(obj.age)
          : null,
      gender: normalizeGender(obj.gender),
      urgency,
    };
  };

  try {
    return parseObject(JSON.parse(rawContent));
  } catch {
    const matched = rawContent.match(/\{[\s\S]*\}/);
    if (!matched) {
      return null;
    }

    try {
      return parseObject(JSON.parse(matched[0]));
    } catch {
      return null;
    }
  }
};

const formatKnowledgeContext = (
  knowledgeContext: TriageKnowledgeContext | undefined,
  lang: TriageLang
) => {
  if (!knowledgeContext || knowledgeContext.snippets.length === 0) {
    return "";
  }

  const intro =
    lang === "zh"
      ? "以下是仅供分诊参考的内部知识片段。你只能辅助提取信息和判断紧急度，不能据此做最终诊断。"
      : "Below are internal knowledge snippets for triage support only. Use them to improve extraction quality and urgency judgment, not to make a final diagnosis.";

  const snippets = knowledgeContext.snippets
    .map(
      (snippet, index) =>
        `#${index + 1} ${snippet.title}\n${snippet.content}\nRisk codes: ${snippet.riskCodes.join(", ") || "none"}\nSpecialty tags: ${snippet.specialtyTags.join(", ") || "none"}`
    )
    .join("\n\n");

  return `${intro}\n\n${snippets}`;
};

async function extractTriageDraft(input: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  lang: TriageLang;
  knowledgeContext?: TriageKnowledgeContext;
  intake?: Partial<TriageIntake> | null;
}) {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: [
          input.lang === "zh"
            ? TRIAGE_EXTRACTION_PROMPT_ZH
            : TRIAGE_EXTRACTION_PROMPT_EN,
          formatKnowledgeContext(input.knowledgeContext, input.lang),
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            structuredIntake: hasStructuredTriageInput(input.intake)
              ? normalizeTriageIntake(input.intake)
              : null,
            conversation: input.messages,
          },
          null,
          2
        ),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: TRIAGE_EXTRACTION_SCHEMA,
    },
    max_tokens: 700,
  });

  const rawContent = extractAssistantText(
    response.choices[0]?.message?.content
  );
  return parseExtractionDraft(rawContent);
}

export async function processTriageChat(
  messages: TriageChatMessage[],
  lang: TriageLang = "en",
  knowledgeContext?: TriageKnowledgeContext,
  intake?: Partial<TriageIntake> | null
): Promise<TriageResponse> {
  const sanitizedHistory = messages
    .filter(
      item =>
        item &&
        typeof item.role === "string" &&
        typeof item.content === "string" &&
        item.content.trim().length > 0
    )
    .map(item => ({
      role:
        item.role === "assistant" ||
        item.role === "user" ||
        item.role === "system"
          ? item.role
          : "user",
      content: item.content.trim(),
    })) as Array<{ role: "system" | "user" | "assistant"; content: string }>;

  let extractedDraft: TriageExtractionDraft | null = null;
  try {
    extractedDraft = await extractTriageDraft({
      messages: sanitizedHistory,
      lang,
      knowledgeContext,
      intake,
    });
  } catch (error) {
    console.error("[Triage] extractTriageDraft failed:", error);
  }

  const merged = mergeTriageData({
    intake,
    extracted: extractedDraft,
  });
  const recommendation = resolveRecommendedDepartment({
    data: merged,
    knowledgeContext,
  });
  const missingFields = Array.from(
    new Set([
      ...listMissingTriageFields(merged),
      ...recommendation.missingCriticalFields,
    ])
  );
  const userTurns = sanitizedHistory.filter(
    message => message.role === "user"
  ).length;
  const shouldAskFollowup =
    missingFields.length > 0 &&
    (userTurns < 2 ||
      (recommendation.missingCriticalFields.length > 0 && userTurns < 3));

  if (shouldAskFollowup) {
    return {
      isComplete: false,
      reply: buildFollowupReply({
        lang,
        missingFields,
      }),
      extraction: buildTriageExtractionOutput(merged, lang),
    };
  }

  const completedData = coerceMissingFieldsForCompletion(merged, lang);
  const summary = buildTriageSummary(completedData, lang);
  const keywords = buildRecommendationKeywords({
    data: completedData,
    lang,
    knowledgeContext,
  });
  const completedRecommendation = resolveRecommendedDepartment({
    data: completedData,
    knowledgeContext,
  });
  const routing = await buildHospitalRouting({
    data: completedData,
    lang,
    knowledgeContext,
  });

  return {
    isComplete: true,
    reply: buildCompletionReply(lang, completedRecommendation),
    summary,
    keywords,
    routing,
    extraction: buildTriageExtractionOutput(completedData, lang),
  };
}
