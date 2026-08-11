import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getReferralCopy,
  parsePositiveNumberParam,
  ReferralPaymentScreen,
} from "@/features/referrals";

function readOrderId() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  return parsePositiveNumberParam(params.get("orderId"));
}

export default function ReferralPaymentPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const orderId = readOrderId();

  return (
    <AppLayout title={copy.payment.title}>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        {orderId ? (
          <ReferralPaymentScreen orderId={orderId} lang={lang} />
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              {copy.payment.missingOrder}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
