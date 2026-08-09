import type { LocalizedText } from "@shared/types";
import { TRPCError } from "@trpc/server";
import type { AppointmentStatus } from "../appointments/publicApi";
import { adminAppointmentIntakeSchema } from "./schemas";

export const resolveActorRole = (role?: string) => {
  if (role === "ops") {
    return "ops";
  }
  return "admin";
};

export const assertAdminAction = (role?: string) => {
  if (role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have required permission (10002)",
    });
  }
};

export const HOSPITAL_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const HOSPITAL_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
export const HOSPITAL_IMAGE_DEFAULT_MIME = "image/jpeg";
export const HOSPITAL_IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const DATA_URL_PREFIX_RE = /^data:([^;]+);base64,/i;

export const stripDataUrl = (value: string) => {
  const match = DATA_URL_PREFIX_RE.exec(value);
  if (!match) {
    return {
      value: value.trim().replace(/\s+/g, ""),
      contentType: HOSPITAL_IMAGE_DEFAULT_MIME,
    };
  }
  return {
    value: value.slice(match[0].length).trim().replace(/\s+/g, ""),
    contentType: match[1] || HOSPITAL_IMAGE_DEFAULT_MIME,
  };
};

export const resolveHospitalImageContentType = (
  inputContentType: string | undefined
) => {
  const normalized = (inputContentType ?? "").trim().toLowerCase();
  if (HOSPITAL_IMAGE_MIME_TYPES.has(normalized)) {
    return normalized;
  }
  return HOSPITAL_IMAGE_DEFAULT_MIME;
};

export const resolveHospitalImageExtension = (
  fileName: string | undefined,
  contentType: string
) => {
  const fileNameExt = fileName
    ?.trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)$/)?.[1];
  if (fileNameExt) {
    return fileNameExt;
  }
  return HOSPITAL_IMAGE_EXT_BY_MIME[contentType] ?? "jpg";
};

export function parseIntakeFromNotes(notes: string | null | undefined) {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    const result = adminAppointmentIntakeSchema.safeParse(parsed);
    if (!result.success) {
      return null;
    }

    const hasAnyField = Object.values(result.data).some(
      value => typeof value === "string" && value.trim().length > 0
    );
    return hasAnyField ? result.data : null;
  } catch {
    return null;
  }
}

export const ADMIN_ALLOWED_TRANSITION_FROM: AppointmentStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
];

export const deriveSummaryText = (input: {
  appointmentId: number;
  summaryZh: string;
  summaryEn: string;
  generatedAt: Date | string | null;
  source: string;
  lang: "zh" | "en";
}) => {
  const body = input.lang === "zh" ? input.summaryZh : input.summaryEn;
  const generatedAt =
    input.generatedAt instanceof Date
      ? input.generatedAt.toISOString()
      : (input.generatedAt ?? "");
  return [
    input.lang === "zh" ? "MediBridge 会后总结" : "MediBridge Visit Summary",
    `${input.lang === "zh" ? "问诊单" : "Appointment"} #${input.appointmentId}`,
    `${input.lang === "zh" ? "生成时间" : "Generated at"}: ${generatedAt || "-"}`,
    `${input.lang === "zh" ? "来源" : "Source"}: ${input.source || "unknown"}`,
    "",
    body.trim(),
  ].join("\n");
};

export const toLocalizedText = (input: {
  zh: string | null | undefined;
  en: string | null | undefined;
}): LocalizedText => ({
  zh: input.zh ?? "",
  en: input.en ?? "",
});

export const toCsvCell = (value: unknown) => {
  const raw = value === undefined || value === null ? "" : String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
};

export const formatCsvRows = (rows: Array<Record<string, unknown>>) => {
  if (rows.length === 0) {
    return "";
  }
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(toCsvCell).join(",");
  const lines = rows.map(row =>
    headers
      .map(key =>
        toCsvCell(row[key] instanceof Date ? row[key].toISOString() : row[key])
      )
      .join(",")
  );
  return [headerLine, ...lines].join("\n");
};

export const normalizeAmountFilter = (
  value: number | undefined,
  side: "min" | "max"
) => {
  if (value === undefined || !Number.isInteger(value) || value < 0) {
    return undefined;
  }
  return side === "min" ? value : value;
};

export const toDate = (input: Date | string | undefined | null) => {
  if (!input) {
    return undefined;
  }
  const parsed = input instanceof Date ? input : new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const normalizeBatchActionInput = (input: {
  action: "resend_access_link" | "reinitiate_payment" | "update_status";
  idempotencyKey?: string;
  toStatus?: AppointmentStatus;
  toPaymentStatus?:
    | "unpaid"
    | "pending"
    | "paid"
    | "failed"
    | "expired"
    | "refunded"
    | "canceled";
}) => ({
  action: input.action,
  idempotencyKey: (input.idempotencyKey ?? "").trim().slice(0, 80),
  toStatus: input.toStatus,
  toPaymentStatus: input.toPaymentStatus,
});

export const buildWebhookReplayEventRow = (input: {
  event: {
    eventId: string;
    type: string;
    stripeSessionId: string | null;
    appointmentId: number | null;
  };
  action: string;
}) => ({
  eventId: input.event.eventId,
  eventType: input.event.type,
  action: input.action,
  stripeSessionId: input.event.stripeSessionId,
  appointmentId: input.event.appointmentId,
});
