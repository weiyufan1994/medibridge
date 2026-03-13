import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AdminUserItem, AdminUserRole } from "@/features/admin/types";

type TranslateFn = (zh: string, en: string) => string;

type UserRoleManagementCardProps = {
  tr: TranslateFn;
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
  tr,
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
  const [draftRoles, setDraftRoles] = useState<Record<number, AdminUserRole>>({});

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

  return (
    <Card className="rounded-2xl border-slate-200/80 shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-5 w-5 text-teal-600" />
            {tr("用户与权限", "Users & Roles")}
          </CardTitle>
          <p className="text-sm text-slate-500">
            {tr(
              "在后台直接查看正式用户并调整 free / pro / admin / ops 权限。",
              "Review formal users and adjust free / pro / admin / ops roles directly."
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            placeholder={tr("按邮箱或姓名搜索", "Search by email or name")}
            className="w-full sm:w-72"
          />
          <Button type="button" variant="outline" onClick={onRefresh}>
            {tr("刷新", "Refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isReadOnly ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {tr(
              "只有 admin 可以调整用户权限。ops 可查看但不可修改。",
              "Only admin can change user roles. Ops may review but cannot edit."
            )}
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-slate-500">
                  <th className="px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">{tr("用户", "User")}</th>
                  <th className="px-4 py-3 font-medium">{tr("登录方式", "Login method")}</th>
                  <th className="px-4 py-3 font-medium">{tr("最近登录", "Last signed in")}</th>
                  <th className="px-4 py-3 font-medium">{tr("当前权限", "Current role")}</th>
                  <th className="px-4 py-3 font-medium">{tr("操作", "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {tr("正在加载用户列表...", "Loading users...")}
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      {tr("没有匹配的正式用户。", "No matching formal users found.")}
                    </td>
                  </tr>
                ) : (
                  rows.map(user => {
                    const changed = user.draftRole !== user.role;
                    return (
                      <tr key={user.id} className="align-top">
                        <td className="px-4 py-4 font-medium text-slate-900">{user.id}</td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[220px] items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-slate-100 p-2 text-slate-500">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div className="space-y-1">
                              <div className="font-medium text-slate-900">
                                {user.name?.trim() || tr("未命名用户", "Unnamed user")}
                              </div>
                              <div className="text-slate-500">{user.email ?? "-"}</div>
                              <div className="text-xs text-slate-400">
                                {tr("创建于", "Created")} {formatDateTime(user.createdAt, locale)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{user.loginMethod ?? "-"}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatDateTime(user.lastSignedIn, locale)}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-700">
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex min-w-[180px] items-center gap-2">
                            <select
                              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                              value={user.draftRole}
                              disabled={isReadOnly || isUpdating}
                              onChange={event => {
                                setDraftRoles(current => ({
                                  ...current,
                                  [user.id]: event.target.value as AdminUserRole,
                                }));
                              }}
                            >
                              {ROLE_OPTIONS.map(role => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              size="sm"
                              disabled={isReadOnly || isUpdating || !changed}
                              onClick={() => {
                                onUpdateRole({
                                  userId: user.id,
                                  role: user.draftRole,
                                });
                              }}
                            >
                              {tr("保存", "Save")}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
