import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Loader2, MailCheck } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

function readInviteToken() {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

export default function DoctorClaimInvitePage() {
  const token = useMemo(() => readInviteToken(), []);
  const { resolved } = useLanguage();
  const lang = resolved as "zh" | "en";
  const tr = (zh: string, en: string) =>
    getLocalizedText({ lang, value: { zh, en }, placeholder: zh });
  const { loading, isAuthenticated, openLoginModal, user } = useAuth();
  const utils = trpc.useUtils();

  const claimMutation = trpc.doctorAccounts.claimInvite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.doctorAccounts.getMyBinding.invalidate(),
      ]);
      toast.success(
        tr("医生工作台已开通，可以进入工作台。", "Doctor workbench has been activated.")
      );
      if (typeof window !== "undefined") {
        window.location.href = "/doctor/workbench";
      }
    },
    onError: error => {
      toast.error(error.message || tr("认领邀请失败。", "Failed to claim doctor invite."));
    },
  });

  useEffect(() => {
    if (loading || !isAuthenticated || !token || claimMutation.isPending || claimMutation.isSuccess) {
      return;
    }
    void claimMutation.mutateAsync({ token });
  }, [claimMutation, isAuthenticated, loading, token]);

  if (loading) {
    return (
      <AppLayout title={tr("认领医生工作台", "Claim Doctor Workbench")}>
        <div className="flex min-h-[50vh] w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (!token) {
    return (
      <AppLayout title={tr("认领医生工作台", "Claim Doctor Workbench")}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>{tr("邀请链接无效", "Invalid Invite Link")}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {tr("缺少邀请 token，请重新打开管理员发送的邀请邮件。", "The invite token is missing. Re-open the invite email from your admin.")}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <AppLayout title={tr("认领医生工作台", "Claim Doctor Workbench")}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-teal-600" />
                {tr("先登录再认领", "Sign In to Claim")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                {tr(
                  "请使用受邀邮箱登录，然后系统会自动完成医生工作台认领。",
                  "Please sign in with the invited email, then the workbench claim will complete automatically."
                )}
              </p>
              <Button onClick={openLoginModal}>{tr("登录并继续", "Sign In and Continue")}</Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tr("认领医生工作台", "Claim Doctor Workbench")}>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>{tr("正在认领工作台", "Claiming Workbench")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              {tr(
                `当前登录邮箱：${user?.email ?? "-"}`,
                `Signed in as: ${user?.email ?? "-"}`
              )}
            </p>
            {claimMutation.error ? (
              <>
                <p className="text-destructive">{claimMutation.error.message}</p>
                <Link href="/doctor/workbench">
                  <Button variant="outline">{tr("返回工作台", "Back to Workbench")}</Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr("正在校验邀请并激活医生身份...", "Validating invite and activating doctor identity...")}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
