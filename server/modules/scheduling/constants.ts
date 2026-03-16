export const SLOT_STATUS_VALUES = [
  "open",
  "held",
  "booked",
  "blocked",
  "expired",
] as const;

export const SLOT_SOURCE_VALUES = ["rule", "manual"] as const;

export const SCHEDULE_EXCEPTION_ACTION_VALUES = [
  "block",
  "extend",
  "replace",
] as const;

export const SCHEDULE_ACTOR_ROLE_VALUES = ["admin", "ops", "doctor"] as const;

export const SLOT_HOLD_MINUTES = 10;
export const SLOT_GENERATION_WINDOW_DAYS = 14;

export type SlotStatus = (typeof SLOT_STATUS_VALUES)[number];
export type SlotSource = (typeof SLOT_SOURCE_VALUES)[number];
export type ScheduleExceptionAction = (typeof SCHEDULE_EXCEPTION_ACTION_VALUES)[number];
export type ScheduleActorRole = (typeof SCHEDULE_ACTOR_ROLE_VALUES)[number];
