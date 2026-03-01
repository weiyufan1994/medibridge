import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type TriageChatMessage = {
  role: string;
  content: string;
};

export interface TriageResponse {
  isComplete: boolean;
  reply: string;
  summary?: string;
  keywords?: string[];
}

export type TriageLang = "en" | "zh";

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

const resolveEmbeddingsApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/embeddings`
    : "https://forge.manus.im/v1/embeddings";

const assertApiKey = () => {
  if (!ENV.forgeApiKey) {
    throw new Error(
      "LLM API key is not configured. Set BUILT_IN_FORGE_API_KEY or FORGE_API_KEY or OPENAI_API_KEY"
    );
  }
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  assertApiKey();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    maxTokens,
    max_tokens,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  const payload: Record<string, unknown> = {
    model: ENV.llmModel || "deepseek-ai/DeepSeek-V3",
    messages: messages.map(normalizeMessage),
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  payload.max_tokens = maxTokens ?? max_tokens ?? 4096;

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }

  const response = await fetch(resolveApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  return (await response.json()) as InvokeResult;
}

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
        },
        required: ["isComplete", "reply", "summary", "keywords"],
        additionalProperties: false,
      },
    ],
  },
};

const TRIAGE_SYSTEM_PROMPT_ZH = `你是 MediBridge 的专业分诊护士（Triage Nurse）。
目标：通过对话收集最关键就诊信息，并判断是否可进入医生推荐阶段。

行为要求：
1) 语气专业、温和、有同理心，避免制造恐慌。
2) 每轮优先补齐缺失信息：主要症状、持续时间、严重程度、伴随症状、既往史/慢病、用药/过敏、年龄段。
3) 未收集完整前，isComplete 必须为 false，并在 reply 中提出 1-2 个最关键追问。
4) 收集完整后，isComplete 设为 true：
   - reply 为简短结束语，告知将推荐医生；
   - summary 为结构化摘要（可读文本，分号分隔），最多 8 条核心信息；
   - keywords 提供 3-5 个用于检索医生的关键词（症状/疾病/科室混合，简洁具体），必须至少包含 1 个科室/专科词。
5) 禁止输出 Markdown、代码块或额外字段；必须只返回 JSON。`;

const TRIAGE_SYSTEM_PROMPT_EN = `You are MediBridge's professional triage nurse.
Goal: collect key intake details and decide whether doctor recommendation can start.

Behavior requirements:
1) Keep a professional, calm, empathetic tone.
2) Prioritize missing details each turn: main symptoms, duration, severity, associated symptoms, history/chronic diseases, current meds/allergies, age group.
3) If information is incomplete, set isComplete=false and ask 1-2 high-yield follow-up questions in reply.
4) If information is complete, set isComplete=true:
   - reply: concise closing line that you are ready to recommend doctors;
   - summary: structured triage summary in readable text, separated by semicolons, MAX 8 key items only;
   - keywords: 3-5 concise keywords for doctor matching (mix of symptom/disease/department), MUST include at least one department/specialty term.
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

type EmbeddingResult = {
  data?: Array<{ embedding?: number[] }>;
};

export async function createEmbedding(input: string): Promise<number[]> {
  assertApiKey();

  const cleanedInput = input.trim();
  if (!cleanedInput) {
    throw new Error("Embedding input cannot be empty");
  }

  const response = await fetch(resolveEmbeddingsApiUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      model: ENV.llmEmbeddingModel,
      input: cleanedInput,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Embedding create failed: ${response.status} ${response.statusText} – ${errorText}`
    );
  }

  const payload = (await response.json()) as EmbeddingResult;
  const embedding = payload.data?.[0]?.embedding;

  if (!embedding || embedding.length === 0) {
    throw new Error("Embedding response did not contain a valid vector");
  }

  return embedding;
}
