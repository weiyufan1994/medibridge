import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resolved === "zh" ? "邮箱登录" : "Email Sign In"}</DialogTitle>
          <DialogDescription>
            {step === "email"
              ? resolved === "zh"
                ? "输入邮箱发送验证码，无需密码。"
                : "Enter your email to receive a verification code. No password required."
              : resolved === "zh"
                ? `验证码已发送至 ${trimmedEmail || "你的邮箱"}`
                : `Code sent to ${trimmedEmail || "your email"}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {step === "email" ? (
            <div className="space-y-3">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={requestOtpMutation.isPending || verifyOtpMutation.isPending}
              />
              <Button className="w-full" onClick={() => void handleRequestOtp()} disabled={!canRequestOtp}>
                {requestOtpMutation.isPending
                  ? resolved === "zh"
                    ? "发送中..."
                    : "Sending..."
                  : resolved === "zh"
                    ? "发送验证码"
                    : "Send code"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
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
              <Button
                className="w-full"
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
                className="w-full"
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
