const DEFAULT_CONSULTATION_DURATION_MINUTES = 30;
const FREE_EXTENSION_MINUTES = 5;

export type ConsultationTimerState = {
  baseDurationMinutes: number;
  extensionMinutes: number;
  totalDurationMinutes: number;
  hasUsedFreeExtension: boolean;
};

type ConsultationTimerExtendResult =
  | {
      ok: true;
      timer: ConsultationTimerState;
      nextNotes: string;
    }
  | {
      ok: false;
      reason: "invalid_minutes" | "already_used";
      timer: ConsultationTimerState;
    };

function toFinitePositiveInteger(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : null;
}

function parseNotesObject(notes: string | null | undefined): Record<string, unknown> | null {
  const normalized = notes?.trim();
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toTimerStateFromNotesObject(
  notesObject: Record<string, unknown> | null
): ConsultationTimerState {
  const baseDurationMinutes =
    toFinitePositiveInteger(notesObject?.packageDurationMinutes) ??
    DEFAULT_CONSULTATION_DURATION_MINUTES;
  const extensionMinutesRaw =
    toFinitePositiveInteger(notesObject?.timerExtensionMinutes) ?? 0;
  const extensionMinutes = Math.max(0, extensionMinutesRaw);
  const hasUsedByFlag = notesObject?.timerExtensionUsed === true;
  const hasUsedFreeExtension = hasUsedByFlag || extensionMinutes > 0;

  return {
    baseDurationMinutes,
    extensionMinutes,
    totalDurationMinutes: baseDurationMinutes + extensionMinutes,
    hasUsedFreeExtension,
  };
}

export function resolveConsultationTimerState(
  notes: string | null | undefined
): ConsultationTimerState {
  return toTimerStateFromNotesObject(parseNotesObject(notes));
}

export function applyConsultationFreeExtensionToNotes(input: {
  notes: string | null | undefined;
  extensionMinutes: number;
}): ConsultationTimerExtendResult {
  const notesObject = parseNotesObject(input.notes);
  const currentState = toTimerStateFromNotesObject(notesObject);

  if (
    !Number.isInteger(input.extensionMinutes) ||
    input.extensionMinutes !== FREE_EXTENSION_MINUTES
  ) {
    return {
      ok: false,
      reason: "invalid_minutes",
      timer: currentState,
    };
  }

  if (currentState.hasUsedFreeExtension) {
    return {
      ok: false,
      reason: "already_used",
      timer: currentState,
    };
  }

  const nextObject: Record<string, unknown> = {
    ...(notesObject ?? {}),
    timerExtensionMinutes: input.extensionMinutes,
    timerExtensionUsed: true,
  };
  const nextTimer = toTimerStateFromNotesObject(nextObject);

  return {
    ok: true,
    timer: nextTimer,
    nextNotes: JSON.stringify(nextObject),
  };
}

export {
  DEFAULT_CONSULTATION_DURATION_MINUTES,
  FREE_EXTENSION_MINUTES,
};
