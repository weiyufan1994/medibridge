import type { Request } from "express";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../../_core/llm";
import * as aiRepo from "../ai/repo";
import * as visitRepo from "../visit/repo";
import * as appointmentsRepo from "./repo";
import { validateAppointmentToken } from "./accessValidation";
import { parseIntakeFromNotes } from "./accessQueryActions";
import { completeAppointmentByDoctor } from "./statusActions";
import { rescheduleAppointmentByToken } from "./rescheduleActions";
import { toPublicAppointment } from "./serializers";
import { APPOINTMENT_INVALID_TRANSITION_ERROR } from "./stateMachine";
import {
  appointmentIntakeSchema,
  medicalSummaryDraftOutputSchema,
} from "./schemas";

type ValidatedAppointment = Awaited<
  ReturnType<typeof validateAppointmentToken>
>["appointment"];

const medicalSummaryDraftTaskByAppointmentId = new Map<number, Promise<void>>();
const PENDING_MEDICAL_SUMMARY_DRAFT = {
  chiefComplaint: "",
  historyOfPresentIllness: "",
  pastMedicalHistory: "",
  assessmentDiagnosis: "",
  planRecommendations: "",
  source: "pending" as const,
};

export async function rescheduleByTokenFlow(input: {
  appointmentId: number;
  token: string;
  newScheduledAt: Date;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "join_room",
    input.req
  );
  const updated = await rescheduleAppointmentByToken({
    appointmentId: appointment.id,
    role,
    newScheduledAt: input.newScheduledAt,
    currentStatus: appointment.status,
  });

  return toPublicAppointment(updated);
}

export async function completeAppointmentByTokenFlow(input: {
  appointmentId: number;
  token: string;
  operatorId: number | null;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "send_message",
    input.req
  );

  return completeAppointmentByDoctor({
    appointmentId: appointment.id,
    role,
    operatorId: input.operatorId,
  });
}

function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map(item => {
      if (
        item &&
        typeof item === "object" &&
        "type" in item &&
        (item as { type?: string }).type === "text"
      ) {
        return String((item as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n")
    .trim();
}

function toFallbackDraft(input: {
  lang: "en" | "zh";
  triageSummary?: string | null;
  intake: {
    chiefComplaint?: string;
    medicalHistory?: string;
  } | null;
}) {
  const chiefComplaint = input.intake?.chiefComplaint?.trim() || "";
  const pastMedicalHistory = input.intake?.medicalHistory?.trim() || "";
  const triageSummary = input.triageSummary?.trim() || "";

  if (input.lang === "zh") {
    return {
      chiefComplaint: chiefComplaint || "患者主诉待医生补充。",
      historyOfPresentIllness: triageSummary || "请结合会诊记录补充现病史。",
      pastMedicalHistory: pastMedicalHistory || "暂无明确既往史，请补充。",
      assessmentDiagnosis: "请医生补充初步诊断。",
      planRecommendations: "请医生补充处置方案与随访建议。",
      source: "fallback" as const,
    };
  }

  return {
    chiefComplaint: chiefComplaint || "Chief complaint to be completed by doctor.",
    historyOfPresentIllness:
      triageSummary || "Please complete HPI based on consultation transcript.",
    pastMedicalHistory:
      pastMedicalHistory || "No past medical history captured yet. Please complete.",
    assessmentDiagnosis: "Please add assessment / diagnosis.",
    planRecommendations: "Please add plan and follow-up recommendations.",
    source: "fallback" as const,
  };
}

function clampSectionText(input: string) {
  return input.trim().slice(0, 4000);
}

async function persistMedicalSummaryDraft(input: {
  appointmentId: number;
  draft: {
    chiefComplaint: string;
    historyOfPresentIllness: string;
    pastMedicalHistory: string;
    assessmentDiagnosis: string;
    planRecommendations: string;
  };
  source: string;
}) {
  try {
    await appointmentsRepo.upsertMedicalSummaryByAppointmentId({
      appointmentId: input.appointmentId,
      chiefComplaint: clampSectionText(input.draft.chiefComplaint),
      historyOfPresentIllness: clampSectionText(input.draft.historyOfPresentIllness),
      pastMedicalHistory: clampSectionText(input.draft.pastMedicalHistory),
      assessmentDiagnosis: clampSectionText(input.draft.assessmentDiagnosis),
      planRecommendations: clampSectionText(input.draft.planRecommendations),
      source: input.source,
      signedBy: null,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "test") {
      console.warn("[appointments] failed to persist medical summary draft", error);
    }
  }
}

async function generateAndPersistMedicalSummaryDraft(input: {
  appointment: ValidatedAppointment;
  lang: "en" | "zh";
}) {
  const intake = parseIntakeFromNotes(input.appointment.notes, value =>
    appointmentIntakeSchema.safeParse(value)
  );
  const triageSession = await aiRepo.getAiChatSessionById(input.appointment.triageSessionId);
  const triageSummary = triageSession?.summary ?? null;

  const fallback = toFallbackDraft({
    lang: input.lang,
    triageSummary,
    intake,
  });

  const recentMessagesDesc = await visitRepo.getRecentMessages(input.appointment.id, 80);
  const recentMessagesAsc = [...recentMessagesDesc].reverse();
  const transcript = recentMessagesAsc
    .map(item => {
      const content = (item.translatedContent || item.content || "").trim();
      if (!content) {
        return "";
      }
      return `[${item.createdAt.toISOString()}][${item.senderType}] ${content.slice(0, 280)}`;
    })
    .filter(Boolean)
    .join("\n");

  if (!transcript) {
    await persistMedicalSummaryDraft({
      appointmentId: input.appointment.id,
      draft: fallback,
      source: "ai_draft_fallback",
    });
    return fallback;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            input.lang === "zh"
              ? "你是临床病历助手。请根据问诊对话，生成结构化电子病历草稿。必须输出 JSON。"
              : "You are a clinical documentation assistant. Generate a structured medical summary draft from the consultation transcript. Return JSON only.",
        },
        {
          role: "user",
          content: [
            `Appointment ID: ${input.appointment.id}`,
            `Output language: ${input.lang === "zh" ? "Chinese" : "English"}`,
            `Triage summary: ${(triageSummary || "(none)").slice(0, 1200)}`,
            `Intake chief complaint: ${(intake?.chiefComplaint || "(none)").slice(0, 600)}`,
            `Intake medical history: ${(intake?.medicalHistory || "(none)").slice(0, 800)}`,
            "Transcript:",
            transcript,
            "Return JSON object with keys exactly:",
            'chiefComplaint, historyOfPresentIllness, pastMedicalHistory, assessmentDiagnosis, planRecommendations',
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "medical_summary_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              chiefComplaint: { type: "string", minLength: 1, maxLength: 4000 },
              historyOfPresentIllness: { type: "string", minLength: 1, maxLength: 4000 },
              pastMedicalHistory: { type: "string", minLength: 1, maxLength: 4000 },
              assessmentDiagnosis: { type: "string", minLength: 1, maxLength: 4000 },
              planRecommendations: { type: "string", minLength: 1, maxLength: 4000 },
            },
            required: [
              "chiefComplaint",
              "historyOfPresentIllness",
              "pastMedicalHistory",
              "assessmentDiagnosis",
              "planRecommendations",
            ],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 1600,
    });

    const raw = extractAssistantText(response.choices?.[0]?.message?.content);
    const parsed = JSON.parse(raw) as unknown;
    const validation = medicalSummaryDraftOutputSchema
      .omit({ source: true })
      .safeParse(parsed);
    if (!validation.success) {
      await persistMedicalSummaryDraft({
        appointmentId: input.appointment.id,
        draft: fallback,
        source: "ai_draft_fallback",
      });
      return fallback;
    }

    const generated = {
      chiefComplaint: clampSectionText(validation.data.chiefComplaint),
      historyOfPresentIllness: clampSectionText(validation.data.historyOfPresentIllness),
      pastMedicalHistory: clampSectionText(validation.data.pastMedicalHistory),
      assessmentDiagnosis: clampSectionText(validation.data.assessmentDiagnosis),
      planRecommendations: clampSectionText(validation.data.planRecommendations),
      source: "llm" as const,
    };

    const hasAllSections = Boolean(
      generated.chiefComplaint &&
        generated.historyOfPresentIllness &&
        generated.pastMedicalHistory &&
        generated.assessmentDiagnosis &&
        generated.planRecommendations
    );
    if (!hasAllSections) {
      await persistMedicalSummaryDraft({
        appointmentId: input.appointment.id,
        draft: fallback,
        source: "ai_draft_fallback",
      });
      return fallback;
    }

    await persistMedicalSummaryDraft({
      appointmentId: input.appointment.id,
      draft: generated,
      source: "ai_draft_llm",
    });
    return generated;
  } catch {
    await persistMedicalSummaryDraft({
      appointmentId: input.appointment.id,
      draft: fallback,
      source: "ai_draft_fallback",
    });
    return fallback;
  }
}

function startMedicalSummaryDraftGenerationTask(input: {
  appointment: ValidatedAppointment;
  lang: "en" | "zh";
}) {
  if (medicalSummaryDraftTaskByAppointmentId.has(input.appointment.id)) {
    return;
  }

  const task = generateAndPersistMedicalSummaryDraft(input)
    .then(() => undefined)
    .catch(error => {
      if (process.env.NODE_ENV !== "test") {
        console.warn("[appointments] medical summary draft background task failed", error);
      }
    })
    .finally(() => {
      medicalSummaryDraftTaskByAppointmentId.delete(input.appointment.id);
    });

  medicalSummaryDraftTaskByAppointmentId.set(input.appointment.id, task);
}

export async function generateMedicalSummaryDraftByTokenFlow(input: {
  appointmentId: number;
  token: string;
  lang: "en" | "zh";
  forceRegenerate?: boolean;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    input.req
  );

  if (role !== "doctor") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Only doctor can generate medical summary draft",
    });
  }

  const existing = await appointmentsRepo.getMedicalSummaryByAppointmentId(appointment.id);
  if (existing && (!input.forceRegenerate || Boolean(existing.signedBy))) {
    return {
      chiefComplaint: existing.chiefComplaint,
      historyOfPresentIllness: existing.historyOfPresentIllness,
      pastMedicalHistory: existing.pastMedicalHistory,
      assessmentDiagnosis: existing.assessmentDiagnosis,
      planRecommendations: existing.planRecommendations,
      source: "saved" as const,
    };
  }

  if (input.forceRegenerate) {
    return generateAndPersistMedicalSummaryDraft({
      appointment,
      lang: input.lang,
    });
  }

  startMedicalSummaryDraftGenerationTask({
    appointment,
    lang: input.lang,
  });
  return PENDING_MEDICAL_SUMMARY_DRAFT;
}

export async function signMedicalSummaryByTokenFlow(input: {
  appointmentId: number;
  token: string;
  operatorId: number | null;
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  req?: Request;
}) {
  const { appointment, role } = await validateAppointmentToken(
    input.appointmentId,
    input.token,
    "read_history",
    input.req
  );

  if (role !== "doctor") {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Only doctor can sign medical summary",
    });
  }

  const transitioned = await appointmentsRepo.tryTransitionAppointmentById({
    appointmentId: appointment.id,
    allowedFrom: ["paid", "active", "ended", "completed"],
    toStatus: "completed",
    toPaymentStatus: "paid",
    operatorType: "doctor",
    operatorId: input.operatorId,
    reason: "doctor_signed_medical_summary",
  });

  if (!transitioned.ok) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: APPOINTMENT_INVALID_TRANSITION_ERROR,
    });
  }

  await appointmentsRepo.upsertMedicalSummaryByAppointmentId({
    appointmentId: appointment.id,
    chiefComplaint: clampSectionText(input.chiefComplaint),
    historyOfPresentIllness: clampSectionText(input.historyOfPresentIllness),
    pastMedicalHistory: clampSectionText(input.pastMedicalHistory),
    assessmentDiagnosis: clampSectionText(input.assessmentDiagnosis),
    planRecommendations: clampSectionText(input.planRecommendations),
    source: "doctor_reviewed_ai_draft",
    signedBy: input.operatorId,
  });

  const updated = await appointmentsRepo.getAppointmentById(appointment.id);
  if (!updated) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Appointment disappeared after signing medical summary",
    });
  }

  return {
    appointmentId: updated.id,
    status: updated.status,
    paymentStatus: updated.paymentStatus,
  };
}
