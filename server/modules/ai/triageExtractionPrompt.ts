type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export const TRIAGE_EXTRACTION_SCHEMA: JsonSchema = {
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

export const TRIAGE_EXTRACTION_PROMPT_ZH = `你是 MediBridge 的极速分诊信息抽取器。
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

export const TRIAGE_EXTRACTION_PROMPT_EN = `You are MediBridge's fast-triage fact extractor.
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
