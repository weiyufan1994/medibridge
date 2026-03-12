import { useMemo, useState } from "react";
import { Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useLanguage } from "@/contexts/LanguageContext";
import { getOrCreateDeviceId } from "@/features/auth/deviceId";
import { trpc } from "@/lib/trpc";

type LoginModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const { resolved } = useLanguage();
  const utils = trpc.useUtils();
  const setLocation = useLocation()[1];
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: false,
  });

  const requestOtpMutation = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setStep("otp");
      setCode("");
      toast.success(
        resolved === "zh"
          ? "验证码已发送，请查看邮箱。"
          : "Verification code sent. Please check your email."
      );
    },
    onError: error => {
      toast.error(error.message || "验证码发送失败");
    },
  });

  const verifyOtpMutation = trpc.auth.verifyOtpAndMerge.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      const refreshed = await meQuery.refetch();
      const role = String(refreshed.data?.role ?? "");
      if (role === "admin" || role === "ops") {
        setLocation("/admin");
      }
      toast.success(resolved === "zh" ? "登录成功" : "Signed in successfully");
      handleOpenChange(false);
      setStep("email");
      setCode("");
    },
    onError: error => {
      toast.error(error.message || "验证码校验失败");
    },
  });

  const trimmedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const canRequestOtp =
    trimmedEmail.length > 3 && !requestOtpMutation.isPending && !verifyOtpMutation.isPending;
  const canVerifyOtp =
    step === "otp" &&
    code.length === 6 &&
    !requestOtpMutation.isPending &&
    !verifyOtpMutation.isPending;

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setStep("email");
      setCode("");
    }
  };

  const handleRequestOtp = async () => {
    if (!canRequestOtp) {
      return;
    }
    await requestOtpMutation.mutateAsync({ email: trimmedEmail });
  };

  const handleVerifyOtp = async () => {
    const deviceId = getOrCreateDeviceId();
    if (!deviceId) {
      toast.error("无法获取设备标识，请刷新页面后重试。");
      return;
    }
    await verifyOtpMutation.mutateAsync({
      email: trimmedEmail,
      code,
      deviceId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md bg-white rounded-2xl shadow-xl p-8 border-slate-100 gap-0"
      >
        <DialogHeader className="text-center">
          <div className="w-12 h-12 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 mx-auto mb-4">
            <Stethoscope className="w-6 h-6" aria-hidden="true" />
          </div>
          <DialogTitle className="text-2xl font-bold text-slate-900">
            {resolved === "zh" ? "登录或注册" : "Welcome to MediBridge"}
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm mt-2 mb-8">
            {step === "email"
              ? resolved === "zh"
                ? "输入邮箱获取验证码，无需设置密码即可快速进入。"
                : "Enter your email to receive a secure login code."
              : resolved === "zh"
                ? `验证码已发送至 ${trimmedEmail || "你的邮箱"}`
                : `Code sent to ${trimmedEmail || "your email"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {step === "email" ? (
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                onKeyDown={event => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    canRequestOtp
                  ) {
                    event.preventDefault();
                    void handleRequestOtp();
                  }
                }}
                disabled={requestOtpMutation.isPending || verifyOtpMutation.isPending}
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 h-auto focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
              />
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl py-3 h-auto mt-4 transition-colors shadow-sm focus-visible:ring-teal-500"
                onClick={() => void handleRequestOtp()}
                disabled={!canRequestOtp}
              >
                {requestOtpMutation.isPending
                  ? resolved === "zh"
                    ? "发送中..."
                    : "Sending..."
                  : resolved === "zh"
                    ? "获取验证码"
                    : "Send Verification Code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                onKeyDown={event => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    canVerifyOtp
                  ) {
                    event.preventDefault();
                    void handleVerifyOtp();
                  }
                }}
              >
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl py-3 h-auto transition-colors shadow-sm focus-visible:ring-teal-500"
                onClick={() => void handleVerifyOtp()}
                disabled={!canVerifyOtp}
              >
                {verifyOtpMutation.isPending
                  ? resolved === "zh"
                    ? "登录中..."
                    : "Signing in..."
                  : resolved === "zh"
                    ? "确认并登录"
                    : "Confirm and sign in"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
                disabled={requestOtpMutation.isPending || verifyOtpMutation.isPending}
                onClick={() => {
                  setCode("");
                  setStep("email");
                }}
              >
                {resolved === "zh" ? "返回修改邮箱" : "Back to email"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
