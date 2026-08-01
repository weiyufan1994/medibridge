export type ReferralConsultationDraft = {
  consultationTimeInput: string;
  timeZone: string;
  providerName: string;
  platform: string;
  joinUrl: string;
  instructions: string;
  note: string;
};

export type ReferralConsultationDraftIssue =
  | "consultation_time_required"
  | "consultation_time_invalid"
  | "time_zone_required"
  | "provider_required"
  | "platform_required"
  | "join_url_required"
  | "join_url_https_required"
  | "instructions_required";

type DraftStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const REFERRAL_CONSULTATION_DRAFT_KEY_PREFIX =
  "medibridge:admin:referral-consultation-draft";

const DRAFT_FIELDS = [
  "consultationTimeInput",
  "timeZone",
  "providerName",
  "platform",
  "joinUrl",
  "instructions",
  "note",
] as const satisfies readonly (keyof ReferralConsultationDraft)[];

function getDraftStorageKey(orderId: number) {
  return `${REFERRAL_CONSULTATION_DRAFT_KEY_PREFIX}:${orderId}`;
}

function isReferralConsultationDraft(
  value: unknown
): value is ReferralConsultationDraft {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return DRAFT_FIELDS.every(field => typeof record[field] === "string");
}

export function getReferralConsultationDraftIssues(
  draft: ReferralConsultationDraft
): ReferralConsultationDraftIssue[] {
  const issues: ReferralConsultationDraftIssue[] = [];
  const consultationTime = draft.consultationTimeInput.trim();
  const joinUrl = draft.joinUrl.trim();

  if (!consultationTime) {
    issues.push("consultation_time_required");
  } else if (Number.isNaN(new Date(consultationTime).getTime())) {
    issues.push("consultation_time_invalid");
  }
  if (!draft.timeZone.trim()) {
    issues.push("time_zone_required");
  }
  if (!draft.providerName.trim()) {
    issues.push("provider_required");
  }
  if (!draft.platform.trim()) {
    issues.push("platform_required");
  }
  if (!joinUrl) {
    issues.push("join_url_required");
  } else if (!joinUrl.startsWith("https://")) {
    issues.push("join_url_https_required");
  }
  if (!draft.instructions.trim()) {
    issues.push("instructions_required");
  }

  return issues;
}

export function areReferralConsultationDraftsEqual(
  left: ReferralConsultationDraft,
  right: ReferralConsultationDraft
) {
  return DRAFT_FIELDS.every(field => left[field] === right[field]);
}

export function readReferralConsultationDraft(
  storage: DraftStorage,
  orderId: number
): ReferralConsultationDraft | null {
  try {
    const storedValue = storage.getItem(getDraftStorageKey(orderId));
    if (!storedValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(storedValue);
    return isReferralConsultationDraft(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function saveReferralConsultationDraft(
  storage: DraftStorage,
  orderId: number,
  draft: ReferralConsultationDraft
) {
  try {
    storage.setItem(getDraftStorageKey(orderId), JSON.stringify(draft));
  } catch {
    // A blocked or full browser storage should not prevent referral handling.
  }
}

export function clearReferralConsultationDraft(
  storage: DraftStorage,
  orderId: number
) {
  try {
    storage.removeItem(getDraftStorageKey(orderId));
  } catch {
    // A blocked browser storage should not prevent a successful submission.
  }
}
