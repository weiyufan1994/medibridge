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

export type DoctorWorkbenchAppointmentIntake = {
  chiefComplaint?: string;
  duration?: string;
  medicalHistory?: string;
  medications?: string;
  allergies?: string;
  ageGroup?: string;
  otherSymptoms?: string;
} | null;

export type DoctorWorkbenchMedicalSummary = {
  chiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string;
  assessmentDiagnosis: string;
  planRecommendations: string;
  source: string;
  signedBy: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
} | null;

export type DoctorWorkbenchAppointmentDetail = {
  id: number;
  slotId: number | null;
  doctorId: number;
  triageSessionId: number;
  appointmentType: "online_chat" | "video_call" | "in_person";
  scheduledAt: Date | string | null;
  status: string;
  paymentStatus: string;
  amount: number;
  currency: string;
  paidAt: Date | string | null;
  email: string;
  sessionId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastAccessAt: Date | string | null;
  patient: {
    email: string;
    sessionId: string | null;
  };
  triageSummary: string | null;
  intake: DoctorWorkbenchAppointmentIntake;
  medicalSummary: DoctorWorkbenchMedicalSummary;
  packageId: string | null;
  consultationDurationMinutes: number;
  consultationExtensionMinutes: number;
  consultationTotalMinutes: number;
  canStartConsultation: boolean;
  canOpenRoom: boolean;
  canCompleteConsultation: boolean;
  hasSignedMedicalSummary: boolean;
};
