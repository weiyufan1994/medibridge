import { invokeLLM } from "../server/_core/llm";
import {
  readMessageText,
  sanitizeTranslatedText,
} from "./translate-bilingual-core";
import {
  parseDepartmentBatchResponse,
  parseHospitalBatchResponse,
  type DepartmentBatchTranslation,
  type HospitalBatchTranslation,
} from "./translate-bilingual-parsers";

export type HospitalBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  city: string | null;
  level: string | null;
  address: string | null;
  description: string | null;
};

export type DepartmentBatchInput = {
  id: number;
  sourceHash: string;
  name: string;
  description: string | null;
};

export const translateHospital = async (
  input: {
    name: string;
    city: string | null;
    level: string | null;
    address: string | null;
    description: string | null;
  },
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital information into patient-friendly English. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital fields. Return empty string for missing values.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hospital_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            cityEn: { type: ["string", "null"] },
            levelEn: { type: ["string", "null"] },
            addressEn: { type: ["string", "null"] },
            descriptionEn: { type: ["string", "null"] },
          },
          required: [
            "nameEn",
            "cityEn",
            "levelEn",
            "addressEn",
            "descriptionEn",
          ],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  );
  return parsed as Omit<HospitalBatchTranslation, "id" | "sourceHash">;
};

export const translateHospitalBatch = async (
  input: HospitalBatchInput[],
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital information into patient-friendly English. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "hospital_batch_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  sourceHash: { type: "string" },
                  nameEn: { type: ["string", "null"] },
                  cityEn: { type: ["string", "null"] },
                  levelEn: { type: ["string", "null"] },
                  addressEn: { type: ["string", "null"] },
                  descriptionEn: { type: ["string", "null"] },
                },
                required: [
                  "id",
                  "sourceHash",
                  "nameEn",
                  "cityEn",
                  "levelEn",
                  "addressEn",
                  "descriptionEn",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 4096,
  });

  return parseHospitalBatchResponse(
    readMessageText(response.choices[0].message.content)
  );
};

export const translateDepartment = async (
  input: { name: string; description: string | null },
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese department names and descriptions into patient-friendly English. Use the style 'Department of ...' for names. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following department fields. Return empty string for missing values.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "department_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            descriptionEn: { type: ["string", "null"] },
          },
          required: ["nameEn", "descriptionEn"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  );
  return parsed as Omit<DepartmentBatchTranslation, "id" | "sourceHash">;
};

export const translateDepartmentNameOnly = async (
  name: string,
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate a Chinese medical department name into patient-friendly English. Use the style 'Department of ...' when appropriate. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate this department name into English.\n\n${JSON.stringify(
          { name }
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "department_name_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
          },
          required: ["nameEn"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  );
  return sanitizeTranslatedText(parsed.nameEn);
};

export const translateDepartmentBatch = async (
  input: DepartmentBatchInput[],
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese department names and descriptions into patient-friendly English. Use the style 'Department of ...' for names. Do not add facts or medical advice. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following department list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "department_batch_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  sourceHash: { type: "string" },
                  nameEn: { type: ["string", "null"] },
                  descriptionEn: { type: ["string", "null"] },
                },
                required: ["id", "sourceHash", "nameEn", "descriptionEn"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 2048,
  });

  return parseDepartmentBatchResponse(
    readMessageText(response.choices[0].message.content)
  );
};
