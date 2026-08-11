import { useCallback, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  getAppointmentSelectionScopeKey,
  parseOptionalNonNegativeInteger,
} from "./adminConsoleHelpers";

const APPOINTMENT_STATUS_VALUES = [
  "draft",
  "pending_payment",
  "paid",
  "active",
  "ended",
  "completed",
  "expired",
  "refunded",
  "canceled",
] as const;
const PAYMENT_STATUS_VALUES = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
  "canceled",
] as const;

function toStatusValue(value: string) {
  return APPOINTMENT_STATUS_VALUES.find(status => status === value);
}

function toPaymentStatusValue(value: string) {
  return PAYMENT_STATUS_VALUES.find(status => status === value);
}

export function useAdminAppointmentFilters({
  canReadAdmin,
  isAppointmentsActive,
}: {
  canReadAdmin: boolean;
  isAppointmentsActive: boolean;
}) {
  const [emailQuery, setEmailQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<
    "createdAt" | "scheduledAt" | "amount" | "status" | "paymentStatus" | "id"
  >("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [amountMinInput, setAmountMinInput] = useState("");
  const [amountMaxInput, setAmountMaxInput] = useState("");
  const [createdAtFrom, setCreatedAtFrom] = useState("");
  const [createdAtTo, setCreatedAtTo] = useState("");
  const [scheduledAtFrom, setScheduledAtFrom] = useState("");
  const [scheduledAtTo, setScheduledAtTo] = useState("");
  const [hasRiskFilter, setHasRiskFilter] = useState(false);
  const [selectedAppointmentIds, setSelectedAppointmentIds] = useState<
    number[]
  >([]);

  const appointmentStatusOptions = [
    "",
    "draft",
    "pending_payment",
    "paid",
    "active",
    "ended",
    "completed",
    "expired",
    "refunded",
    "canceled",
  ] as const;
  const paymentStatusOptions = [
    "",
    "unpaid",
    "pending",
    "paid",
    "failed",
    "expired",
    "refunded",
    "canceled",
  ] as const;

  const toNumber = (value: string) => parseOptionalNonNegativeInteger(value);
  const toPositiveNumber = (value: string) => {
    const parsed = toNumber(value);
    if (typeof parsed !== "number" || parsed <= 0) {
      return undefined;
    }
    return parsed;
  };
  const toDate = (value: string) => {
    if (!value.trim()) {
      return undefined;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  };

  const queryFilters = useMemo(
    () => ({
      page,
      pageSize,
      status: (statusFilter || undefined) as
        | "draft"
        | "pending_payment"
        | "paid"
        | "active"
        | "ended"
        | "completed"
        | "expired"
        | "refunded"
        | "canceled"
        | undefined,
      paymentStatus: (paymentStatusFilter || undefined) as
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "expired"
        | "refunded"
        | "canceled"
        | undefined,
      doctorId: toPositiveNumber(doctorIdInput),
      amountMin: toNumber(amountMinInput),
      amountMax: toNumber(amountMaxInput),
      createdAtFrom: toDate(createdAtFrom),
      createdAtTo: toDate(createdAtTo),
      scheduledAtFrom: toDate(scheduledAtFrom),
      scheduledAtTo: toDate(scheduledAtTo),
      hasRisk: hasRiskFilter || undefined,
      sortBy,
      sortDirection,
      emailQuery: emailQuery.trim() || undefined,
    }),
    [
      amountMaxInput,
      amountMinInput,
      createdAtFrom,
      createdAtTo,
      doctorIdInput,
      emailQuery,
      hasRiskFilter,
      page,
      pageSize,
      paymentStatusFilter,
      scheduledAtFrom,
      scheduledAtTo,
      sortBy,
      sortDirection,
      statusFilter,
    ]
  );

  const appointmentsQuery = trpc.system.adminAppointments.useQuery(
    queryFilters,
    { enabled: canReadAdmin && isAppointmentsActive }
  );

  useEffect(() => {
    setPage(current => (current === 1 ? current : 1));
  }, [
    amountMaxInput,
    amountMinInput,
    createdAtFrom,
    createdAtTo,
    doctorIdInput,
    emailQuery,
    hasRiskFilter,
    paymentStatusFilter,
    scheduledAtFrom,
    scheduledAtTo,
    statusFilter,
  ]);

  const appointmentSelectionScopeKey = getAppointmentSelectionScopeKey({
    amountMaxInput,
    amountMinInput,
    createdAtFrom,
    createdAtTo,
    doctorIdInput,
    emailQuery,
    hasRiskFilter,
    page,
    pageSize,
    paymentStatusFilter,
    scheduledAtFrom,
    scheduledAtTo,
    sortBy,
    sortDirection,
    statusFilter,
  });

  useEffect(() => {
    setSelectedAppointmentIds([]);
  }, [appointmentSelectionScopeKey]);

  const resetAppointmentFilters = useCallback(() => {
    setEmailQuery("");
    setStatusFilter("");
    setPaymentStatusFilter("");
    setDoctorIdInput("");
    setAmountMinInput("");
    setAmountMaxInput("");
    setCreatedAtFrom("");
    setCreatedAtTo("");
    setScheduledAtFrom("");
    setScheduledAtTo("");
    setHasRiskFilter(false);
    setSortBy("createdAt");
    setSortDirection("desc");
    setPage(1);
  }, []);

  const visibleIds = useMemo(
    () => (appointmentsQuery.data?.items ?? []).map(item => item.id),
    [appointmentsQuery.data?.items]
  );
  const selectedAppointmentSet = useMemo(
    () => new Set(selectedAppointmentIds),
    [selectedAppointmentIds]
  );
  const isAllVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every(itemId => selectedAppointmentSet.has(itemId));
  const isAnyVisibleSelected = visibleIds.some(itemId =>
    selectedAppointmentSet.has(itemId)
  );
  const isSelected = useCallback(
    (id: number) => selectedAppointmentSet.has(id),
    [selectedAppointmentSet]
  );
  const toggleAppointmentSelection = useCallback(
    (appointmentId: number, checked: boolean) => {
      setSelectedAppointmentIds(previous => {
        const normalized = new Set(previous);
        if (checked) {
          normalized.add(appointmentId);
        } else {
          normalized.delete(appointmentId);
        }
        return Array.from(normalized);
      });
    },
    []
  );
  const toggleSelectAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedAppointmentIds(previous => {
        const normalized = new Set(previous);
        if (checked) {
          visibleIds.forEach(itemId => normalized.add(itemId));
        } else {
          visibleIds.forEach(itemId => normalized.delete(itemId));
        }
        return Array.from(normalized);
      });
    },
    [visibleIds]
  );
  const clearSelection = useCallback(() => {
    setSelectedAppointmentIds([]);
  }, []);

  return {
    emailQuery,
    statusFilter,
    paymentStatusFilter,
    page,
    pageSize,
    sortBy,
    sortDirection,
    doctorIdInput,
    amountMinInput,
    amountMaxInput,
    createdAtFrom,
    createdAtTo,
    scheduledAtFrom,
    scheduledAtTo,
    hasRiskFilter,
    selectedAppointmentIds,
    appointmentStatusOptions,
    paymentStatusOptions,
    appointmentsQuery,
    exportFilters: {
      pageSize,
      status: toStatusValue(statusFilter),
      paymentStatus: toPaymentStatusValue(paymentStatusFilter),
      doctorId: queryFilters.doctorId,
      amountMin: queryFilters.amountMin,
      amountMax: queryFilters.amountMax,
      createdAtFrom: queryFilters.createdAtFrom,
      createdAtTo: queryFilters.createdAtTo,
      scheduledAtFrom: queryFilters.scheduledAtFrom,
      scheduledAtTo: queryFilters.scheduledAtTo,
      hasRisk: queryFilters.hasRisk,
      sortBy,
      sortDirection,
    },
    isAllVisibleSelected,
    isAnyVisibleSelected,
    isSelected,
    setEmailQuery,
    setStatusFilter,
    setPaymentStatusFilter,
    setPage,
    setPageSize,
    setSortBy,
    setSortDirection,
    setDoctorIdInput,
    setAmountMinInput,
    setAmountMaxInput,
    setCreatedAtFrom,
    setCreatedAtTo,
    setScheduledAtFrom,
    setScheduledAtTo,
    setHasRiskFilter,
    resetAppointmentFilters,
    toggleAppointmentSelection,
    toggleSelectAllVisible,
    clearSelection,
  };
}
