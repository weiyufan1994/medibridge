import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TranslateFn = (zh: string, en: string) => string;

export function DoctorWorkbenchAccessState(props: {
  kind: "loading" | "login_required" | "access_denied" | "not_enabled";
  tr: TranslateFn;
  userEmail?: string | null;
  onLogin?: () => void;
}) {
  const title = props.tr("医生工作台", "Doctor Workbench");

  if (props.kind === "loading") {
    return (
      <AppLayout title={title}>
        <div className="flex min-h-[50vh] w-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
        </div>
      </AppLayout>
    );
  }

  if (props.kind === "login_required") {
    return (
      <AppLayout title={title}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>{props.tr("需要先登录", "Login Required")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                {props.tr(
                  "医生工作台当前要求已登录后访问。",
                  "The doctor workbench currently requires authentication."
                )}
              </p>
              <Button onClick={props.onLogin}>
                {props.tr("登录后继续", "Sign In to Continue")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (props.kind === "access_denied") {
    return (
      <AppLayout title={title}>
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>
                {props.tr("工作台访问被拒绝", "Workbench Access Denied")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <p>
                {props.tr(
                  "当前登录账号已绑定到其他医生档案，不能访问这个 doctorId 的工作台。",
                  "The current account is bound to a different doctor and cannot access this workbench URL."
                )}
              </p>
              <Link href="/doctor/workbench">
                <Button>
                  {props.tr("进入我的工作台", "Open My Workbench")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={title}>
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle>
              {props.tr("尚未开通工作台", "Workbench Not Enabled")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600">
            <p>
              {props.tr(
                "当前邮箱还没有绑定医生工作台。请让管理员发送邀请，并使用受邀邮箱登录后完成认领。",
                "This account is not bound to a doctor workbench yet. Ask an admin to send an invite, then claim it with the invited email."
              )}
            </p>
            <p className="text-xs text-slate-500">
              {props.userEmail
                ? props.tr(
                    `当前登录邮箱：${props.userEmail}`,
                    `Signed in as: ${props.userEmail}`
                  )
                : props.tr(
                    "当前账号没有绑定邮箱。",
                    "The current account does not have a bound email."
                  )}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
