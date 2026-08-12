import { invokeLLM } from "../server/_core/llm";
import {
  DEFAULT_TIMEOUT_MS,
  readMessageText,
  resolveTranslationModel,
  sanitizeTranslatedText,
} from "./translate-triage-hospital-reference-helpers";

export async function translateHospitalBatch(
  input: Array<{ id: number; name: string; city: string | null }>
) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese hospital names and city names into concise patient-friendly English. Use official or widely accepted English names when known. Do not add facts. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following hospital references. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "triage_hospital_reference_translation",
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
                  nameEn: { type: ["string", "null"] },
                  cityEn: { type: ["string", "null"] },
                },
                required: ["id", "nameEn", "cityEn"],
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

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  ) as
    | {
        items?: Array<{
          id: number;
          nameEn?: string | null;
          cityEn?: string | null;
          name?: string | null;
          city?: string | null;
        }>;
      }
    | Array<{
        id: number;
        nameEn?: string | null;
        cityEn?: string | null;
        name?: string | null;
        city?: string | null;
      }>;
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);

  return new Map(
    items.flatMap(item => {
      if (!Number.isFinite(item.id) || item.id <= 0) {
        return [];
      }

      return [
        [
          item.id,
          {
            nameEn: sanitizeTranslatedText(item.nameEn ?? item.name),
            cityEn: sanitizeTranslatedText(item.cityEn ?? item.city),
          },
        ] as const,
      ];
    })
  );
}

export async function translateHospitalSingle(input: {
  name: string;
  city: string | null;
}) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate the Chinese hospital name and city into concise patient-friendly English. Use official or widely accepted English names when known. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "single_triage_hospital_reference_translation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            nameEn: { type: ["string", "null"] },
            cityEn: { type: ["string", "null"] },
          },
          required: ["nameEn", "cityEn"],
          additionalProperties: false,
        },
      },
    },
    max_tokens: 512,
  });

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  ) as {
    nameEn?: string | null;
    cityEn?: string | null;
    name?: string | null;
    city?: string | null;
  };

  return {
    nameEn: sanitizeTranslatedText(parsed.nameEn ?? parsed.name),
    cityEn: sanitizeTranslatedText(parsed.cityEn ?? parsed.city),
  };
}

export async function translateSpecialtyBatch(
  input: Array<{ id: number; name: string }>
) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese medical specialty names into concise patient-friendly English. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following specialty names. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "triage_hospital_reference_specialty_translation",
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
                  nameEn: { type: ["string", "null"] },
                },
                required: ["id", "nameEn"],
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

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  ) as
    | {
        items?: Array<{
          id: number;
          nameEn?: string | null;
          name?: string | null;
        }>;
      }
    | Array<{
        id: number;
        nameEn?: string | null;
        name?: string | null;
      }>;
  const items = Array.isArray(parsed) ? parsed : (parsed.items ?? []);

  return new Map(
    items.flatMap(item => {
      if (!Number.isFinite(item.id) || item.id <= 0) {
        return [];
      }

      return [
        [
          item.id,
          {
            nameEn: sanitizeTranslatedText(item.nameEn ?? item.name),
          },
        ] as const,
      ];
    })
  );
}

export async function translateSpecialtySingle(input: { name: string }) {
  const response = await invokeLLM({
    model: resolveTranslationModel(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate the Chinese medical specialty name into concise patient-friendly English. Return JSON only.",
      },
      {
        role: "user",
        content: JSON.stringify(input),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "single_triage_hospital_reference_specialty_translation",
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
    max_tokens: 256,
  });

  const parsed = JSON.parse(
    readMessageText(response.choices[0].message.content)
  ) as {
    nameEn?: string | null;
    name?: string | null;
  };

  return {
    nameEn: sanitizeTranslatedText(parsed.nameEn ?? parsed.name),
  };
}
