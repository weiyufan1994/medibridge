import { ReferralAdminPanel } from "@/features/admin/components/ReferralAdminPanel";

type ReferralWorkspaceConsoleProps = {
  currentUserId: number | null;
  currentUserRole: string | null;
  requestedOrderId?: number | null;
};

export function ReferralWorkspaceConsole({
  currentUserId,
  currentUserRole,
  requestedOrderId,
}: ReferralWorkspaceConsoleProps) {
  return (
    <ReferralAdminPanel
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      requestedOrderId={requestedOrderId}
    />
  );
}
