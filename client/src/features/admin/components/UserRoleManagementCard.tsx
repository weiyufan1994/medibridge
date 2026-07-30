import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getAdminRoleCapabilitySummary,
  getAdminUserManagementCopy,
  type AdminLang,
} from "@/features/admin/copy";
import type { AdminUserItem, AdminUserRole } from "@/features/admin/types";

type UserRoleManagementCardProps = {
  lang: AdminLang;
  locale: string;
  isLoading: boolean;
  errorMessage?: string;
  users: AdminUserItem[];
  isReadOnly: boolean;
  isUpdating: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onRefresh: () => void;
  onUpdateRole: (input: { userId: number; role: AdminUserRole }) => void;
};

const ROLE_OPTIONS: AdminUserRole[] = ["free", "pro", "admin", "ops"];

function formatDateTime(value: Date | string, locale: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function UserRoleManagementCard({
  lang,
  locale,
  isLoading,
  errorMessage,
  users,
  isReadOnly,
  isUpdating,
  searchQuery,
  onSearchQueryChange,
  onRefresh,
  onUpdateRole,
}: UserRoleManagementCardProps) {
  const copy = getAdminUserManagementCopy(lang);
  const [draftRoles, setDraftRoles] = useState<Record<number, AdminUserRole>>(
    {}
  );
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  useEffect(() => {
    setDraftRoles(current => {
      const next = { ...current };
      for (const user of users) {
        next[user.id] = user.role;
      }
      return next;
    });
  }, [users]);

  const rows = useMemo(
    () =>
      users.map(user => ({
        ...user,
        draftRole: draftRoles[user.id] ?? user.role,
      })),
    [draftRoles, users]
  );
  const selectedUser = rows.find(user => user.id === selectedUserId) ?? null;

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-admin-border bg-admin-surface">
        <div className="flex flex-col gap-3 border-b border-admin-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold text-admin-foreground">
              <ShieldCheck className="size-4 text-admin-accent-foreground" />
              {copy.title}
            </h2>
            <p className="text-sm text-admin-muted-foreground">
              {copy.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={searchQuery}
              onChange={event => onSearchQueryChange(event.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchPlaceholder}
              className="w-full sm:w-72"
            />
            <Button type="button" variant="outline" onClick={onRefresh}>
              {copy.refresh}
            </Button>
          </div>
        </div>

        {isReadOnly ? (
          <div className="border-b border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {copy.readOnlyNotice}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-admin-border text-sm">
            <thead className="bg-admin-surface-muted">
              <tr className="text-left text-admin-muted-foreground">
                <th className="px-4 py-2.5 font-medium">ID</th>
                <th className="px-4 py-2.5 font-medium">{copy.user}</th>
                <th className="px-4 py-2.5 font-medium">{copy.loginMethod}</th>
                <th className="px-4 py-2.5 font-medium">{copy.lastSignedIn}</th>
                <th className="px-4 py-2.5 font-medium">{copy.currentRole}</th>
                <th className="px-4 py-2.5 text-right font-medium">
                  {copy.action}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border bg-admin-surface">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-admin-muted-foreground"
                  >
                    {copy.loading}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-admin-muted-foreground"
                  >
                    {copy.empty}
                  </td>
                </tr>
              ) : (
                rows.map(user => (
                  <tr
                    key={user.id}
                    className="transition-colors hover:bg-admin-surface-muted/70"
                  >
                    <td className="px-4 py-3 font-medium text-admin-foreground">
                      {user.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[220px] items-center gap-3">
                        <div className="rounded-full bg-admin-surface-muted p-2 text-admin-muted-foreground">
                          <UserRound className="size-4" />
                        </div>
                        <div>
                          <div className="font-medium text-admin-foreground">
                            {user.name?.trim() || copy.unnamed}
                          </div>
                          <div className="text-admin-muted-foreground">
                            {user.email ?? "-"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-admin-muted-foreground">
                      {user.loginMethod ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-admin-muted-foreground">
                      {formatDateTime(user.lastSignedIn, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-admin-border bg-admin-surface-muted px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-admin-foreground">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedUserId(user.id)}
                      >
                        {copy.viewDetails}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Sheet
        open={selectedUser !== null}
        onOpenChange={open => {
          if (!open) {
            setSelectedUserId(null);
          }
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b border-admin-border pr-12">
            <SheetTitle>{copy.detailTitle}</SheetTitle>
            <SheetDescription>{copy.detailDescription}</SheetDescription>
          </SheetHeader>

          {selectedUser ? (
            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {copy.identity}
                </h3>
                <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
                  <dt className="text-muted-foreground">ID</dt>
                  <dd className="font-medium">{selectedUser.id}</dd>
                  <dt className="text-muted-foreground">{copy.user}</dt>
                  <dd className="min-w-0">
                    <div className="font-medium">
                      {selectedUser.name?.trim() || copy.unnamed}
                    </div>
                    <div className="break-all text-muted-foreground">
                      {selectedUser.email ?? "-"}
                    </div>
                  </dd>
                  <dt className="text-muted-foreground">{copy.loginMethod}</dt>
                  <dd>{selectedUser.loginMethod ?? "-"}</dd>
                  <dt className="text-muted-foreground">{copy.createdAt}</dt>
                  <dd>{formatDateTime(selectedUser.createdAt, locale)}</dd>
                  <dt className="text-muted-foreground">{copy.lastSignedIn}</dt>
                  <dd>{formatDateTime(selectedUser.lastSignedIn, locale)}</dd>
                </dl>
              </section>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {copy.capabilitySummary}
                </h3>
                <p className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                  {getAdminRoleCapabilitySummary(selectedUser.draftRole, lang)}
                </p>
              </section>

              <section className="space-y-2">
                <label
                  htmlFor={`admin-user-role-${selectedUser.id}`}
                  className="text-sm font-semibold text-foreground"
                >
                  {copy.roleAssignment}
                </label>
                <select
                  id={`admin-user-role-${selectedUser.id}`}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedUser.draftRole}
                  disabled={isReadOnly || isUpdating}
                  onChange={event => {
                    setDraftRoles(current => ({
                      ...current,
                      [selectedUser.id]: event.target.value as AdminUserRole,
                    }));
                  }}
                >
                  {ROLE_OPTIONS.map(role => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </section>
            </div>
          ) : null}

          <SheetFooter className="border-t border-admin-border">
            <Button
              type="button"
              disabled={
                !selectedUser ||
                isReadOnly ||
                isUpdating ||
                selectedUser.draftRole === selectedUser.role
              }
              onClick={() => {
                if (!selectedUser) {
                  return;
                }
                onUpdateRole({
                  userId: selectedUser.id,
                  role: selectedUser.draftRole,
                });
              }}
            >
              {copy.saveRole}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
