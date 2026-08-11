import type { LocalizedText } from "@shared/types";

export type AdminErrorLike = {
  message: string;
};

export type QueryState<TData> = {
  isLoading: boolean;
  error: AdminErrorLike | null;
  data: TData | undefined;
  refetch: () => Promise<{
    data: TData | undefined;
  }>;
};

export type SimpleMutation = {
  isPending: boolean;
};

export type AppointmentIdInput = {
  appointmentId: number;
};

export type AdminUserRole = "free" | "pro" | "admin" | "ops";

export type UpdateUserRoleMutation = SimpleMutation & {
  mutate: (input: { userId: number; role: AdminUserRole }) => void;
  mutateAsync: (input: {
    userId: number;
    role: AdminUserRole;
  }) => Promise<unknown>;
};

export type AdminUserItem = {
  id: number;
  email: string | null;
  name: string | null;
  role: AdminUserRole;
  loginMethod: string | null;
  lastSignedIn: Date | string;
  createdAt: Date | string;
};

export type AdminHospital = {
  id: number;
  name: LocalizedText;
  city: LocalizedText;
  level: LocalizedText;
  imageUrl: string | null;
};

export type HospitalImageUploadState = {
  isPending: boolean;
  uploadHospitalImage: (hospitalId: number, file: File) => void;
};

export type HospitalImageClearState = {
  isPending: boolean;
  clearHospitalImage: (hospitalId: number) => void;
};

export type VisitSummaryData = {
  summary: LocalizedText;
};

export type VisitSummaryQuery = {
  isLoading: boolean;
  data: VisitSummaryData | null | undefined;
};
