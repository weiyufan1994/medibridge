import {
  REFERRAL_ORDER_STATUS_VALUES,
  type ReferralOrderStatus,
} from "@shared/referrals";

export type ReferralStatusDraft = {
  fromStatus: ReferralOrderStatus;
  toStatus: ReferralOrderStatus;
  reason: string;
};

type DraftStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const REFERRAL_STATUS_DRAFT_KEY_PREFIX =
  "medibridge:admin:referral-status-draft";
const REFERRAL_ORDER_STATUS_SET = new Set<string>(REFERRAL_ORDER_STATUS_VALUES);

function getReferralStatusDraftKey(orderId: number) {
  return `${REFERRAL_STATUS_DRAFT_KEY_PREFIX}:${orderId}`;
}

function isReferralOrderStatus(value: unknown): value is ReferralOrderStatus {
  return typeof value === "string" && REFERRAL_ORDER_STATUS_SET.has(value);
}

function isReferralStatusDraft(value: unknown): value is ReferralStatusDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    isReferralOrderStatus(record.fromStatus) &&
    isReferralOrderStatus(record.toStatus) &&
    typeof record.reason === "string"
  );
}

export function isReferralStatusDraftCompatible(input: {
  draft: ReferralStatusDraft;
  currentStatus: ReferralOrderStatus;
  allowedTargets: ReferralOrderStatus[];
}) {
  return (
    input.draft.fromStatus === input.currentStatus &&
    input.allowedTargets.includes(input.draft.toStatus)
  );
}

export function readReferralStatusDraft(
  storage: DraftStorage,
  orderId: number
): ReferralStatusDraft | null {
  try {
    const storedValue = storage.getItem(getReferralStatusDraftKey(orderId));
    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return isReferralStatusDraft(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function saveReferralStatusDraft(
  storage: DraftStorage,
  orderId: number,
  draft: ReferralStatusDraft
) {
  try {
    storage.setItem(getReferralStatusDraftKey(orderId), JSON.stringify(draft));
  } catch {
    // A blocked or full browser storage should not prevent referral handling.
  }
}

export function clearReferralStatusDraft(
  storage: DraftStorage,
  orderId: number
) {
  try {
    storage.removeItem(getReferralStatusDraftKey(orderId));
  } catch {
    // A blocked browser storage should not prevent a successful submission.
  }
}
