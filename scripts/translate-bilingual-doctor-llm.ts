import { invokeLLM } from "../server/_core/llm";
import {
  readMessageText,
  sanitizeTranslatedText,
} from "./translate-bilingual-core";
import { parseDoctorBatchResponse } from "./translate-bilingual-parsers";
import {
  doctorTranslationKeys,
  parseDoctorPartialResponse,
  type DoctorBatchInput,
  type DoctorPartialInput,
  type DoctorTranslatedField,
} from "./translate-bilingual-doctor-support";

export const translateDoctor = async (
  input: DoctorPartialInput,
  model: string | undefined,
  requestedFields: DoctorTranslatedField[] = doctorTranslationKeys
) => {
  const schemaProperties = Object.fromEntries(
    requestedFields.map(field => [field, { type: ["string", "null"] }])
  );
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese doctor information into patient-friendly English. Do not add facts or medical advice. Doctor names must not be translated into Western names; use pinyin or 'Dr. + pinyin'. Only return the requested English fields in JSON.",
      },
      {
        role: "user",
        content: `Translate the following doctor fields. Return only these English keys: ${requestedFields.join(
          ", "
        )}. Return empty string for missing values.\n\n${JSON.stringify(input)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "doctor_translation",
        strict: true,
        schema: {
          type: "object",
          properties: schemaProperties,
          required: requestedFields,
          additionalProperties: false,
        },
      },
    },
  });

  return parseDoctorPartialResponse(
    readMessageText(response.choices[0].message.content),
    requestedFields
  );
};

export const translateDoctorFieldText = async (
  field: DoctorTranslatedField,
  sourceValue: string,
  model: string | undefined
) => {
  const fieldInstructions: Record<DoctorTranslatedField, string> = {
    nameEn:
      "Translate the Chinese doctor's name into English using pinyin or the format 'Dr. + pinyin'. Return plain text only.",
    titleEn:
      "Translate the Chinese medical title into concise English. Return plain text only.",
    specialtyEn:
      "Translate the Chinese specialty or department into patient-friendly English. Return plain text only.",
    expertiseEn:
      "Translate the Chinese doctor expertise summary into concise patient-friendly English. Return plain text only.",
    onlineConsultationEn:
      "Translate the Chinese online consultation field into concise English. Return plain text only. If unavailable, return an empty string.",
    appointmentAvailableEn:
      "Translate the Chinese appointment availability field into concise English. Return plain text only. If unavailable, return an empty string.",
    satisfactionRateEn:
      "Translate the Chinese satisfaction-rate field into concise English. Return plain text only. If unavailable, return an empty string.",
    attitudeScoreEn:
      "Translate the Chinese attitude-score field into concise English. Return plain text only. If unavailable, return an empty string.",
  };

  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Return plain English text only. Do not add notes, placeholders, or explanations.",
      },
      {
        role: "user",
        content: `${fieldInstructions[field]}\n\n${sourceValue}`,
      },
    ],
    response_format: { type: "text" },
    max_tokens: 512,
  });

  return sanitizeTranslatedText(
    readMessageText(response.choices[0].message.content)
  );
};

export const translateDoctorBatch = async (
  input: DoctorBatchInput[],
  model: string | undefined
) => {
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a professional medical translator. Translate Chinese doctor information into patient-friendly English. Do not add facts or medical advice. Doctor names must not be translated into Western names; use pinyin or 'Dr. + pinyin'. Return JSON only.",
      },
      {
        role: "user",
        content: `Translate the following doctor list. Return strict JSON with items.\n\n${JSON.stringify(
          input
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "doctor_batch_translation",
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
                  titleEn: { type: ["string", "null"] },
                  specialtyEn: { type: ["string", "null"] },
                  expertiseEn: { type: ["string", "null"] },
                  onlineConsultationEn: { type: ["string", "null"] },
                  appointmentAvailableEn: { type: ["string", "null"] },
                  satisfactionRateEn: { type: ["string", "null"] },
                  attitudeScoreEn: { type: ["string", "null"] },
                },
                required: [
                  "id",
                  "sourceHash",
                  "nameEn",
                  "titleEn",
                  "specialtyEn",
                  "expertiseEn",
                  "onlineConsultationEn",
                  "appointmentAvailableEn",
                  "satisfactionRateEn",
                  "attitudeScoreEn",
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

  return parseDoctorBatchResponse(
    readMessageText(response.choices[0].message.content)
  );
};
