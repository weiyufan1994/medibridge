export const parseOptionalNonNegativeInteger = (
  value: string
): number | undefined => {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }
  return parsed;
};

export const getAppointmentSelectionScopeKey = (input: {
  amountMaxInput: string;
  amountMinInput: string;
  createdAtFrom: string;
  createdAtTo: string;
  doctorIdInput: string;
  emailQuery: string;
  hasRiskFilter: boolean;
  page: number;
  pageSize: number;
  paymentStatusFilter: string;
  scheduledAtFrom: string;
  scheduledAtTo: string;
  sortBy: string;
  sortDirection: string;
  statusFilter: string;
}) => JSON.stringify(input);
