import type { Appointment } from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";

type SummaryResult = {
  summaryZh: string;
  summaryEn: string;
  source: "llm" | "fallback";
};

type VisitMessageForSummary = {
  senderType: "patient" | "doctor" | "system";
  content: string;
  translatedContent?: string | null;
  createdAt: Date;
};

function truncateText(input: string, maxLength: number) {
  const normalized = input.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}

function toFallbackSummary(input: {
  appointment: Appointment;
  triageSummary?: string | null;
  messages: VisitMessageForSummary[];
}) {
  const topMessages = input.messages.slice(-8);
  const bullet = topMessages
    .map(message => {
      const body = truncateText(
        (message.translatedContent || message.content || "").trim(),
        72
      );
      return body ? `${message.senderType}: ${body}` : "";
    })
    .filter(Boolean)
    .join("; ");

  const zh = [
    `问诊单 #${input.appointment.id}`,
    input.triageSummary ? `分诊摘要：${truncateText(input.triageSummary, 180)}` : "",
    bullet ? `会话摘录：${bullet}` : "",
    `状态：${input.appointment.status} / 支付：${input.appointment.paymentStatus}`,
  ]
    .filter(Boolean)
    .join("\n");

  const en = [
    `Consultation #${input.appointment.id}`,
    input.triageSummary ? `Triage summary: ${truncateText(input.triageSummary, 180)}` : "",
    bullet ? `Chat highlights: ${bullet}` : "",
    `Status: ${input.appointment.status} / Payment: ${input.appointment.paymentStatus}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    summaryZh: zh,
    summaryEn: en,
    source: "fallback" as const,
  };
}

function tryParseBilingualSummary(raw: string): { summaryZh: string; summaryEn: string } | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.summaryZh !== "string" || typeof obj.summaryEn !== "string") {
      return null;
    }

    const summaryZh = obj.summaryZh.trim();
    const summaryEn = obj.summaryEn.trim();
    if (!summaryZh || !summaryEn) {
      return null;
    }

    return {
      summaryZh: summaryZh.slice(0, 6000),
      summaryEn: summaryEn.slice(0, 6000),
    };
  } catch {
    return null;
  }
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

export async function generateBilingualVisitSummary(input: {
  appointment: Appointment;
  triageSummary?: string | null;
  messages: VisitMessageForSummary[];
}): Promise<SummaryResult> {
  const fallback = toFallbackSummary(input);

  const transcript = input.messages
    .slice(-60)
    .map(message => {
      const body = (message.translatedContent || message.content || "").trim();
      if (!body) {
        return "";
      }
      return `[${message.createdAt.toISOString()}][${message.senderType}] ${truncateText(body, 260)}`;
    })
    .filter(Boolean)
    .join("\n");

  if (!transcript) {
    return fallback;
  }

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "You are a medical operations assistant. Produce bilingual (Chinese + English) post-visit summary. Return JSON only.",
        },
        {
          role: "user",
          content: [
            `Appointment ID: ${input.appointment.id}`,
            `Appointment status: ${input.appointment.status}`,
            `Payment status: ${input.appointment.paymentStatus}`,
            input.triageSummary
              ? `Triage summary: ${truncateText(input.triageSummary, 700)}`
              : "Triage summary: (none)",
            "Conversation transcript:",
            transcript,
            "Output JSON schema: {\"summaryZh\": string, \"summaryEn\": string}",
            "Each summary should include: chief complaint, timeline, key findings, actions completed, and follow-up recommendations.",
          ].join("\n"),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "visit_summary_bilingual",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summaryZh: { type: "string", minLength: 30, maxLength: 6000 },
              summaryEn: { type: "string", minLength: 30, maxLength: 6000 },
            },
            required: ["summaryZh", "summaryEn"],
            additionalProperties: false,
          },
        },
      },
      max_tokens: 1400,
    });

    const text = extractAssistantText(response.choices?.[0]?.message?.content);
    const parsed = tryParseBilingualSummary(text);
    if (!parsed) {
      return fallback;
    }

    return {
      ...parsed,
      source: "llm",
    };
  } catch {
    return fallback;
  }
}
