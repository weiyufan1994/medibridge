import AppLayout from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getReferralCopy,
  parsePositiveNumberParam,
  ReferralPaymentSuccessScreen,
} from "@/features/referrals";

function readPaymentReturnParams() {
  if (typeof window === "undefined") {
    return {
      orderId: null,
      paymentSessionId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    orderId: parsePositiveNumberParam(params.get("orderId")),
    paymentSessionId: params.get("session_id")?.trim() || null,
  };
}

export default function ReferralPaymentSuccessPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const { orderId, paymentSessionId } = readPaymentReturnParams();

  return (
    <AppLayout title={copy.payment.successTitle}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <ReferralPaymentSuccessScreen
          orderId={orderId}
          paymentSessionId={paymentSessionId}
          lang={lang}
        />
      </div>
    </AppLayout>
  );
}
