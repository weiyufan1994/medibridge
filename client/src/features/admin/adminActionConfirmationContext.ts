import { createContext, useContext } from "react";

export type AdminConfirmationRequest = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => unknown | Promise<unknown>;
};

export type AdminActionConfirmationContextValue = {
  requestConfirmation: (request: AdminConfirmationRequest) => void;
};

export const AdminActionConfirmationContext =
  createContext<AdminActionConfirmationContextValue | null>(null);

export function useAdminActionConfirmation() {
  const context = useContext(AdminActionConfirmationContext);
  if (!context) {
    throw new Error(
      "useAdminActionConfirmation must be used within AdminActionConfirmationProvider"
    );
  }
  return context;
}
