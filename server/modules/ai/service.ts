import {
  type InvokeResult,
  invokeLLM,
} from "../../_core/llm";

export type TriageChatMessage = {
  role: string;
  content: string;
};

export interface TriageResponse {
  isComplete: boolean;
  reply: string;
  summary?: string;
  keywords?: string[];
  extraction?: {
    symptoms: string;
    duration: string;
    age: number | null;
    urgency: "low" | "medium" | "high";
  };
}

export type TriageLang = "en" | "zh";

type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

const TRIAGE_JSON_SCHEMA: JsonSchema = {
  name: "triage_response",
  strict: true,
  schema: {
    oneOf: [
      {
        type: "object",
        properties: {
          isComplete: { type: "boolean", const: false },
          reply: { type: "string", minLength: 5, maxLength: 300 },
        },
        required: ["isComplete", "reply"],
        additionalProperties: false,
      },
      {
        type: "object",
        properties: {
          isComplete: { type: "boolean", const: true },
          reply: { type: "string", minLength: 5, maxLength: 300 },
          summary: { type: "string", minLength: 20, maxLength: 1000 },
          keywords: {
            type: "array",
            minItems: 3,
            maxItems: 5,
            items: { type: "string", minLength: 2, maxLength: 40 },
          },
          extraction: {
            type: "object",
            properties: {
              symptoms: { type: "string", minLength: 2, maxLength: 300 },
              duration: { type: "string", minLength: 1, maxLength: 120 },
              age: { type: ["number", "null"] },
              urgency: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["symptoms", "duration", "age", "urgency"],
            additionalProperties: false,
          },
        },
        required: ["isComplete", "reply", "summary", "keywords", "extraction"],
        additionalProperties: false,
      },
    ],
  },
};

const TRIAGE_SYSTEM_PROMPT_ZH = `你是一个专业的分诊医生。
语言要求：所有 reply、summary、keywords、extraction 字段必须严格使用中文输出，不得混用英文。
核心目标：在 5 到 8 个对话回合内，快速收集完患者信息并生成分诊报告；给出报告后，必须引导患者去预约医生，并明确表示对话即将结束。

行为要求：
1) 语气专业、温和、有同理心，避免制造恐慌。
2) 每轮优先补齐缺失信息：主要症状、持续时间、严重程度、伴随症状、既往史/慢病、用药/过敏、年龄段。
3) 未收集完整前，isComplete 必须为 false，并在 reply 中提出 1-2 个最关键追问；严格控制追问数量，避免无效延长对话。
4) 收集完整后，isComplete 设为 true：
   - reply 必须包含“建议立即预约医生”与“对话即将结束”的明确提示；
   - summary 为结构化摘要（可读文本，分号分隔），最多 8 条核心信息；
   - keywords 提供 3-5 个用于检索医生的关键词（症状/疾病/科室混合，简洁具体），必须至少包含 1 个科室/专科词。
   - extraction 为结构化字段：
     symptoms（主要症状描述，简洁）、
     duration（病程，如“3天/2周/间歇性半年”）、
     age（数字或 null）、
     urgency（low/medium/high）。
5) 禁止输出 Markdown、代码块或额外字段；必须只返回 JSON。`;

const TRIAGE_SYSTEM_PROMPT_EN = `You are a professional triage doctor.
Language requirement: strictly output all reply, summary, keywords, and extraction fields in English only.
Core objective: finish data collection and produce a triage report within 5-8 dialogue turns; after the report, you must guide the patient to book a doctor and clearly state the conversation is ending.

Behavior requirements:
1) Keep a professional, calm, empathetic tone.
2) Prioritize missing details each turn: main symptoms, duration, severity, associated symptoms, history/chronic diseases, current meds/allergies, age group.
3) If information is incomplete, set isComplete=false and ask 1-2 high-yield follow-up questions; do not prolong the conversation with low-value questions.
4) If information is complete, set isComplete=true:
   - reply: must explicitly advise booking a doctor immediately and indicate the conversation is about to end;
   - summary: structured triage summary in readable text, separated by semicolons, MAX 8 key items only;
   - keywords: 3-5 concise keywords for doctor matching (mix of symptom/disease/department), MUST include at least one department/specialty term.
   - extraction: structured fields:
     symptoms (concise main complaint),
     duration (e.g. "3 days", "2 weeks", "intermittent for 6 months"),
     age (number or null),
     urgency (low/medium/high).
5) Return JSON only. No markdown, no code block, no extra keys.`;

const TRIAGE_FALLBACK_REPLY_ZH =
  "我已收到你的信息。为更准确匹配医生，请补充：主要不适部位、持续时间，以及是否有既往病史或正在用药。";
const TRIAGE_FALLBACK_REPLY_EN =
  "Thanks, I got your details. To match doctors more accurately, please share the main symptom location, duration, and any medical history or current medications.";

const normalizeKeywords = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;

  const normalized = value
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 5);

  return normalized.length > 0 ? normalized : undefined;
};

const langSafeFallbackDuration = (raw: string) => {
  const normalized = raw.toLowerCase();
  if (normalized.includes("day") || normalized.includes("week") || normalized.includes("month")) {
    return "as reported";
  }
  return "unspecified";
};

const parseTriageResponse = (rawContent: string): TriageResponse | null => {
  const parseObject = (payload: unknown): TriageResponse | null => {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    if (typeof obj.isComplete !== "boolean" || typeof obj.reply !== "string") {
      return null;
    }

    const response: TriageResponse = {
      isComplete: obj.isComplete,
      reply: obj.reply.trim() || TRIAGE_FALLBACK_REPLY_EN,
    };

    if (response.isComplete) {
      if (typeof obj.summary === "string" && obj.summary.trim().length > 0) {
        response.summary = obj.summary.trim().slice(0, 1000);
      }
      const keywords = normalizeKeywords(obj.keywords);
      if (keywords) {
        response.keywords = keywords;
      }
      if (obj.extraction && typeof obj.extraction === "object") {
        const extraction = obj.extraction as Record<string, unknown>;
        const ageValue =
          typeof extraction.age === "number" && Number.isFinite(extraction.age)
            ? extraction.age
            : null;
        const urgencyValue =
          extraction.urgency === "low" ||
          extraction.urgency === "medium" ||
          extraction.urgency === "high"
            ? extraction.urgency
            : "medium";
        response.extraction = {
          symptoms:
            typeof extraction.symptoms === "string" && extraction.symptoms.trim().length > 0
              ? extraction.symptoms.trim().slice(0, 300)
              : response.summary ?? "",
          duration:
            typeof extraction.duration === "string" && extraction.duration.trim().length > 0
              ? extraction.duration.trim().slice(0, 120)
              : langSafeFallbackDuration(rawContent),
          age: ageValue,
          urgency: urgencyValue,
        };
      }
    }

    return response;
  };

  try {
    return parseObject(JSON.parse(rawContent));
  } catch {
    const matched = rawContent.match(/\{[\s\S]*\}/);
    if (!matched) return null;

    try {
      return parseObject(JSON.parse(matched[0]));
    } catch {
      return null;
    }
  }
};

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

export async function processTriageChat(
  messages: TriageChatMessage[],
  lang: TriageLang = "en"
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
        item.role === "assistant" || item.role === "user" || item.role === "system"
          ? item.role
          : "user",
      content: item.content.trim(),
    })) as Array<{ role: "system" | "user" | "assistant"; content: string }>;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: lang === "zh" ? TRIAGE_SYSTEM_PROMPT_ZH : TRIAGE_SYSTEM_PROMPT_EN,
        },
        ...sanitizedHistory,
      ],
      response_format: {
        type: "json_schema",
        json_schema: TRIAGE_JSON_SCHEMA,
      },
      max_tokens: 900,
    });

    const rawContent = extractAssistantText(response.choices[0]?.message?.content);
    const parsed = parseTriageResponse(rawContent);
    if (parsed) {
      return parsed;
    }
    console.warn("[Triage] Invalid JSON payload received from model:", rawContent);
  } catch (error) {
    console.error("[Triage] processTriageChat failed:", error);
  }

  return {
    isComplete: false,
    reply: lang === "zh" ? TRIAGE_FALLBACK_REPLY_ZH : TRIAGE_FALLBACK_REPLY_EN,
  };
}
