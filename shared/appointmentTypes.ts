export const APPOINTMENT_TYPE_VALUES = [
  "online_chat",
  "video_call",
  "in_person",
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPE_VALUES)[number];
