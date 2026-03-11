import { useEffect, useMemo, useRef } from "react";

export type ConsultationTimerStatus = "normal" | "warning" | "expired";

export type ConsultationTimerState = {
  remainingSeconds: number;
  remainingLabel: string;
  status: ConsultationTimerStatus;
};

export type ConsultationTimerSnapshot = ConsultationTimerState & {
  didJustExpire: boolean;
};

export type ComputeConsultationTimerInput = {
  now: Date;
  scheduledAt: Date | string | null | undefined;
  baseDurationMinutes: number;
  extensionMinutes?: number;
};

const WARNING_THRESHOLD_SECONDS = 5 * 60;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toSafeMinutes(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value ?? 0));
}

function formatRemainingLabel(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function computeConsultationTimerState(
  input: ComputeConsultationTimerInput
): ConsultationTimerState {
  const scheduledAt = toDate(input.scheduledAt);
  const baseDurationSeconds = toSafeMinutes(input.baseDurationMinutes) * 60;
  const extensionSeconds = toSafeMinutes(input.extensionMinutes ?? 0) * 60;
  const totalDurationSeconds = baseDurationSeconds + extensionSeconds;

  const elapsedSeconds = scheduledAt
    ? Math.max(0, Math.floor((input.now.getTime() - scheduledAt.getTime()) / 1000))
    : 0;
  const rawRemainingSeconds = totalDurationSeconds - elapsedSeconds;
  const remainingSeconds = Math.max(0, rawRemainingSeconds);

  const status: ConsultationTimerStatus =
    rawRemainingSeconds <= 0
      ? "expired"
      : rawRemainingSeconds <= WARNING_THRESHOLD_SECONDS
        ? "warning"
        : "normal";

  return {
    remainingSeconds,
    remainingLabel: formatRemainingLabel(remainingSeconds),
    status,
  };
}

export function didTransitionToExpired(
  previousStatus: ConsultationTimerStatus,
  currentStatus: ConsultationTimerStatus
) {
  return previousStatus !== "expired" && currentStatus === "expired";
}

export function useConsultationTimer(
  input: ComputeConsultationTimerInput
): ConsultationTimerSnapshot {
  const state = useMemo(() => computeConsultationTimerState(input), [input]);
  const previousStatusRef = useRef<ConsultationTimerStatus>(state.status);
  const didJustExpire = didTransitionToExpired(previousStatusRef.current, state.status);

  useEffect(() => {
    previousStatusRef.current = state.status;
  }, [state.status]);

  return {
    ...state,
    didJustExpire,
  };
}
