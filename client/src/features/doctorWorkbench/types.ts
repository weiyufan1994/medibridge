export type DoctorWorkbenchTranslate = (zh: string, en: string) => string;
export type DoctorWorkbenchLanguage = "zh" | "en";

export type DoctorWorkbenchItem = {
  id: number;
  slotId: number | null;
  doctorId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status: string;
  paymentStatus: string;
  patientEmail: string;
  chiefComplaint: string | null;
  packageId: string | null;
  createdAt: Date | string;
};

export type DoctorWorkbenchSlot = {
  id: number;
  startAt: Date | string;
  slotDurationMinutes: number;
  appointmentType: string;
  status: string;
};
