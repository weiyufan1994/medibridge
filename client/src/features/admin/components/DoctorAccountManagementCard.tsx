import { useMemo, useState } from "react";
import { Loader2, MailPlus, MailQuestion, RefreshCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLocalizedTextWithZhFallback } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

type TranslateFn = (zh: string, en: string) => string;

type Props = {
  tr: TranslateFn;
  lang: "zh" | "en";
};

function formatDateTime(value: Date | string | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export function DoctorAccountManagementCard({ tr, lang }: Props) {
  const [doctorIdInput, setDoctorIdInput] = useState("");
  const [email, setEmail] = useState("");
  const doctorId = Number(doctorIdInput.trim());
  const hasDoctorId = Number.isInteger(doctorId) && doctorId > 0;

  const doctorQuery = trpc.doctors.getById.useQuery(
    { id: hasDoctorId ? doctorId : 0 },
    { enabled: hasDoctorId }
  );
  const statusQuery = trpc.doctorAccounts.getDoctorAccountStatus.useQuery(
    { doctorId: hasDoctorId ? doctorId : 0 },
    { enabled: hasDoctorId }
  );

  const refreshAll = async () => {
    if (!hasDoctorId) return;
    await Promise.all([doctorQuery.refetch(), statusQuery.refetch()]);
  };

  const inviteMutation = trpc.doctorAccounts.invite.useMutation({
    onSuccess: async result => {
      toast.success(tr("医生邀请已发送。", "Doctor invite sent."));
      setEmail(result.invite.email);
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("发送邀请失败。", "Failed to send doctor invite."));
    },
  });
  const resendMutation = trpc.doctorAccounts.resendInvite.useMutation({
    onSuccess: async () => {
      toast.success(tr("医生邀请已重发。", "Doctor invite resent."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("重发邀请失败。", "Failed to resend doctor invite."));
    },
  });
  const cancelMutation = trpc.doctorAccounts.cancelInvite.useMutation({
    onSuccess: async () => {
      toast.success(tr("医生邀请已取消。", "Doctor invite canceled."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("取消邀请失败。", "Failed to cancel doctor invite."));
    },
  });
  const revokeMutation = trpc.doctorAccounts.revokeBinding.useMutation({
    onSuccess: async () => {
      toast.success(tr("医生工作台绑定已撤销。", "Doctor workbench binding revoked."));
      await refreshAll();
    },
    onError: error => {
      toast.error(error.message || tr("撤销绑定失败。", "Failed to revoke doctor binding."));
    },
  });

  const isBusy =
    inviteMutation.isPending ||
    resendMutation.isPending ||
    cancelMutation.isPending ||
    revokeMutation.isPending;

  const doctorLabel = useMemo(() => {
    const doctor = doctorQuery.data?.doctor;
    if (!doctor) {
      return hasDoctorId ? tr(`医生 #${doctorId}`, `Doctor #${doctorId}`) : tr("请输入医生 ID", "Enter a doctor ID");
    }
    return `${getLocalizedTextWithZhFallback({
      lang,
      value: doctor.name,
      placeholder: doctor.name.zh || tr(`医生 #${doctorId}`, `Doctor #${doctorId}`),
    })} (#${doctor.id})`;
  }, [doctorId, doctorQuery.data?.doctor, hasDoctorId, lang, tr]);

  const latestInvite = statusQuery.data?.latestInvite;
  const activeBinding = statusQuery.data?.activeBinding;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("医生账号开通", "Doctor Account Provisioning")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[180px,1fr,auto]">
          <div>
            <Label htmlFor="doctor-account-doctor-id">{tr("医生 ID", "Doctor ID")}</Label>
            <Input
              id="doctor-account-doctor-id"
              value={doctorIdInput}
              onChange={event => setDoctorIdInput(event.target.value)}
              placeholder={tr("例如 11", "e.g. 11")}
              disabled={isBusy}
            />
          </div>
          <div className="rounded border bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <div className="font-medium">{doctorLabel}</div>
            <div className="mt-1 text-xs text-slate-500">
              {tr(
                "医生身份通过后台邀请建立，工作台权限不依赖裸 doctorId URL。",
                "Doctor identity is granted by admin invite; workbench access no longer relies on a bare doctorId URL."
              )}
            </div>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void refreshAll()} disabled={!hasDoctorId || isBusy}>
              <RefreshCcw className="mr-1.5 h-4 w-4" />
              {tr("刷新", "Refresh")}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded border p-4 md:grid-cols-[1fr,auto]">
          <div>
            <Label htmlFor="doctor-account-email">{tr("邀请邮箱", "Invite Email")}</Label>
            <Input
              id="doctor-account-email"
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="doctor@example.com"
              disabled={isBusy}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              disabled={!hasDoctorId || !email.trim() || isBusy}
              onClick={() =>
                void inviteMutation.mutateAsync({
                  doctorId,
                  email: email.trim().toLowerCase(),
                })
              }
            >
              <MailPlus className="mr-1.5 h-4 w-4" />
              {tr("发送邀请", "Send Invite")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <MailQuestion className="h-4 w-4 text-teal-600" />
              {tr("最近邀请", "Latest Invite")}
            </div>
            {statusQuery.isLoading ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在读取邀请状态...", "Loading invite status...")}
              </div>
            ) : latestInvite ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>{tr("邮箱", "Email")}: {latestInvite.email}</p>
                <p>{tr("状态", "Status")}: {latestInvite.status}</p>
                <p>{tr("发送时间", "Sent At")}: {formatDateTime(latestInvite.sentAt)}</p>
                <p>{tr("过期时间", "Expires At")}: {formatDateTime(latestInvite.expiresAt)}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy || !["pending", "sent"].includes(latestInvite.status)}
                    onClick={() => void resendMutation.mutateAsync({ inviteId: latestInvite.id })}
                  >
                    {tr("重发邀请", "Resend")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy || !["pending", "sent"].includes(latestInvite.status)}
                    onClick={() => void cancelMutation.mutateAsync({ inviteId: latestInvite.id })}
                  >
                    {tr("取消邀请", "Cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {tr("当前还没有邀请记录。", "No invite has been sent yet.")}
              </p>
            )}
          </div>

          <div className="rounded border p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <ShieldOff className="h-4 w-4 text-amber-600" />
              {tr("当前绑定", "Current Binding")}
            </div>
            {activeBinding ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <p>{tr("邮箱", "Email")}: {activeBinding.email}</p>
                <p>{tr("状态", "Status")}: {activeBinding.status}</p>
                <p>{tr("绑定时间", "Bound At")}: {formatDateTime(activeBinding.boundAt)}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void revokeMutation.mutateAsync({ doctorId })}
                >
                  {tr("撤销绑定", "Revoke Binding")}
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                {tr("当前没有激活中的医生工作台绑定。", "There is no active doctor workbench binding.")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
