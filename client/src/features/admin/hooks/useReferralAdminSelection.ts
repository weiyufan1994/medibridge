import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { ReferralOrderStatus } from "@shared/referrals";

export type ReferralAdminDetailTab =
  | "operations"
  | "patient"
  | "refund"
  | "timeline";

export function useReferralAdminSelection(requestedOrderId?: number | null) {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<ReferralOrderStatus | "all">(
    "all"
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [detailTab, setDetailTab] =
    useState<ReferralAdminDetailTab>("operations");
  const [usesReferralDrawer, setUsesReferralDrawer] = useState(false);

  const ordersQuery = trpc.referrals.listOrders.useQuery({
    page,
    pageSize: 20,
    status: statusFilter === "all" ? undefined : statusFilter,
    assignedToMe,
    sortDirection,
  });
  const assignableAgentsQuery = trpc.referrals.listAssignableAgents.useQuery();
  const detailQuery = trpc.referrals.getAdminOrderDetail.useQuery(
    { orderId: selectedOrderId ?? 0 },
    { enabled: selectedOrderId !== null }
  );
  const contactsQuery = trpc.referrals.listContactsForAdmin.useQuery(
    { hospitalId: detailQuery.data?.hospital.id ?? 0 },
    { enabled: Boolean(detailQuery.data?.hospital.id) }
  );

  useEffect(() => {
    if (requestedOrderId) {
      setSelectedOrderId(requestedOrderId);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const updateLayoutMode = () => setUsesReferralDrawer(mediaQuery.matches);
    updateLayoutMode();
    mediaQuery.addEventListener("change", updateLayoutMode);
    return () => mediaQuery.removeEventListener("change", updateLayoutMode);
  }, []);

  useEffect(() => {
    if (!usesReferralDrawer || !selectedOrderId) {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedOrderId(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedOrderId, usesReferralDrawer]);

  useEffect(() => {
    const items = ordersQuery.data?.items ?? [];
    if (items.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    if (!selectedOrderId) {
      return;
    }

    const isSelectedVisible = items.some(item => item.id === selectedOrderId);
    if (
      requestedOrderId &&
      selectedOrderId === requestedOrderId &&
      !isSelectedVisible
    ) {
      return;
    }

    if (!isSelectedVisible) {
      setSelectedOrderId(null);
    }
  }, [ordersQuery.data?.items, requestedOrderId, selectedOrderId]);

  useEffect(() => {
    if (!detailQuery.data) {
      return;
    }

    setAssigneeId(
      detailQuery.data.order.assignedAgentId
        ? String(detailQuery.data.order.assignedAgentId)
        : ""
    );
    setSelectedContactId(
      detailQuery.data.contact ? String(detailQuery.data.contact.id) : ""
    );
  }, [detailQuery.data]);

  useEffect(() => {
    setDetailTab("operations");
  }, [selectedOrderId]);

  async function refreshReferralAdminData() {
    await Promise.all([
      utils.referrals.listOrders.invalidate(),
      selectedOrderId
        ? utils.referrals.getAdminOrderDetail.invalidate({
            orderId: selectedOrderId,
          })
        : Promise.resolve(),
      detailQuery.data?.hospital.id
        ? utils.referrals.listContactsForAdmin.invalidate({
            hospitalId: detailQuery.data.hospital.id,
          })
        : Promise.resolve(),
    ]);
  }

  function updateStatusFilter(value: ReferralOrderStatus | "all") {
    setStatusFilter(value);
    setPage(1);
  }

  function updateSortDirection(value: "asc" | "desc") {
    setSortDirection(value);
    setPage(1);
  }

  function updateAssignedToMe(value: boolean) {
    setAssignedToMe(value);
    setPage(1);
  }

  return {
    statusFilter,
    sortDirection,
    assignedToMe,
    page,
    selectedOrderId,
    assigneeId,
    selectedContactId,
    detailTab,
    usesReferralDrawer,
    ordersQuery,
    assignableAgentsQuery,
    detailQuery,
    contactsQuery,
    setPage,
    setSelectedOrderId,
    setAssigneeId,
    setSelectedContactId,
    setDetailTab,
    updateStatusFilter,
    updateSortDirection,
    updateAssignedToMe,
    refreshReferralAdminData,
  };
}
