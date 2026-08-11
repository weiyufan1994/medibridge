export type AdminBatchAction =
  | "resend_access_link"
  | "reinitiate_payment"
  | "update_status";

const APPOINTMENT_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
] as const;
const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
  "canceled",
] as const;

type AdminAppointmentStatus = (typeof APPOINTMENT_STATUS_VALUES)[number];
type AdminPaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export type AdminBatchActionInput = {
  action: AdminBatchAction;
  toStatus?: string;
  toPaymentStatus?: string;
  reason?: string;
  idempotencyKey?: string;
};

export type AdminBatchMutationInput = {
  appointmentIds: number[];
  action: AdminBatchAction;
  toStatus?: AdminAppointmentStatus;
  toPaymentStatus?: AdminPaymentStatus;
  reason: string;
  idempotencyKey: string;
};

function toStatusValue(
  value: string | undefined
): AdminAppointmentStatus | undefined {
  if (
    value &&
    (APPOINTMENT_STATUS_VALUES as readonly string[]).includes(value)
  ) {
    return value as AdminAppointmentStatus;
  }
  return undefined;
}

function toPaymentStatusValue(
  value: string | undefined
): AdminPaymentStatus | undefined {
  if (value && (PAYMENT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as AdminPaymentStatus;
  }
  return undefined;
}

export function isAdminBatchActionAllowed(
  action: AdminBatchAction,
  permissions: {
    canMutateAdmin: boolean;
    canResendAccessLink: boolean;
  }
) {
  if (action === "resend_access_link") {
    return permissions.canResendAccessLink;
  }
  return permissions.canMutateAdmin;
}

export function buildAdminBatchMutationInput(
  appointmentIds: number[],
  input: AdminBatchActionInput,
  createIdempotencyKey: () => string
): AdminBatchMutationInput {
  const reason = input.reason?.trim();
  return {
    appointmentIds: Array.from(new Set(appointmentIds)),
    action: input.action,
    toStatus: toStatusValue(input.toStatus),
    toPaymentStatus: toPaymentStatusValue(input.toPaymentStatus),
    reason: reason || "admin_batch_action",
    idempotencyKey: input.idempotencyKey ?? createIdempotencyKey(),
  };
}

export function createAdminOperationRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
