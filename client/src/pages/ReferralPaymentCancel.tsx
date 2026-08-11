import AppLayout from "@/components/layout/AppLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getReferralCopy,
  parsePositiveNumberParam,
  ReferralPaymentCancelScreen,
} from "@/features/referrals";

function readOrderId() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return parsePositiveNumberParam(params.get("orderId"));
}

export default function ReferralPaymentCancelPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const orderId = readOrderId();

  return (
    <AppLayout title={copy.payment.cancelTitle}>
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <ReferralPaymentCancelScreen orderId={orderId} lang={lang} />
      </div>
    </AppLayout>
  );
}
