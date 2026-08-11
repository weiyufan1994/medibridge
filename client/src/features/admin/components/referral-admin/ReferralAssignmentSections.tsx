import { Button } from "@/components/ui/button";
import { getReferralCopy } from "@/features/referrals";
import type { ReferralAdminTaskKind } from "../../referralAdminPresentation";
import { SectionBox } from "./ReferralAdminPrimitives";

type AgentOption = {
  id: number;
  email: string | null;
  name: string | null;
};

type ContactOption = {
  id: number;
  name: string;
  roleType: string;
};

type ReferralAssignmentSectionsProps = {
  lang: "en" | "zh";
  taskKind: ReferralAdminTaskKind | null;
  currentUserId: number | null;
  assignedAgentId: number | null;
  assigneeId: string;
  agents: AgentOption[];
  selectedContactId: string;
  hasLocalHospitalMapping: boolean;
  contactsLoading: boolean;
  contactsHaveError: boolean;
  contactsErrorMessage?: string;
  contacts: ContactOption[];
  claimPending: boolean;
  assignPending: boolean;
  assignContactPending: boolean;
  onAssigneeIdChange: (value: string) => void;
  onSelectedContactIdChange: (value: string) => void;
  onClaim: () => void;
  onAssign: () => void;
  onAssignContact: () => void;
};

export function ReferralAssignmentSections({
  lang,
  taskKind,
  currentUserId,
  assignedAgentId,
  assigneeId,
  agents,
  selectedContactId,
  hasLocalHospitalMapping,
  contactsLoading,
  contactsHaveError,
  contactsErrorMessage,
  contacts,
  claimPending,
  assignPending,
  assignContactPending,
  onAssigneeIdChange,
  onSelectedContactIdChange,
  onClaim,
  onAssign,
  onAssignContact,
}: ReferralAssignmentSectionsProps) {
  const copy = getReferralCopy(lang);

  if (taskKind !== "assign") {
    return null;
  }

  return (
    <>
      <SectionBox title={copy.admin.claimOrder}>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={
              claimPending ||
              !currentUserId ||
              (assignedAgentId !== null && assignedAgentId !== currentUserId)
            }
            onClick={onClaim}
          >
            {copy.admin.claimOrder}
          </Button>
          <select
            className="h-8 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
            value={assigneeId}
            onChange={event => onAssigneeIdChange(event.target.value)}
          >
            <option value="">{copy.admin.assignPlaceholder}</option>
            {agents.map(user => (
              <option key={user.id} value={String(user.id)}>
                {user.email || user.name || user.id}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={assignPending || Number(assigneeId) <= 0}
            onClick={onAssign}
          >
            {copy.admin.assignOrder}
          </Button>
        </div>
      </SectionBox>

      <SectionBox title={copy.admin.assignContactTitle}>
        {!hasLocalHospitalMapping ? (
          <p className="text-sm text-muted-foreground">
            {copy.admin.noLocalHospitalMapping}
          </p>
        ) : contactsLoading ? (
          <p className="text-sm text-muted-foreground">{copy.common.loading}</p>
        ) : contactsHaveError ? (
          <p className="text-sm text-rose-600">{contactsErrorMessage}</p>
        ) : contacts.length > 0 ? (
          <div className="space-y-2">
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={selectedContactId}
              onChange={event => onSelectedContactIdChange(event.target.value)}
            >
              <option value="">{copy.admin.assignContactPlaceholder}</option>
              {contacts.map(contact => (
                <option key={contact.id} value={String(contact.id)}>
                  {contact.name} · {contact.roleType}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={assignContactPending || Number(selectedContactId) <= 0}
              onClick={onAssignContact}
            >
              {copy.admin.assignContact}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {copy.admin.noContactsForHospital}
          </p>
        )}
      </SectionBox>
    </>
  );
}
