import { useRoute } from "wouter";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReferralOrderDetailScreen } from "@/features/referrals/components/ReferralOrderDetailScreen";
import { getReferralCopy } from "@/features/referrals/copy";
import { parsePositiveNumberParam } from "@/features/referrals/presentation";

export default function ReferralOrderDetailPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const [, params] = useRoute<{ id: string }>("/referrals/orders/:id");
  const orderId = parsePositiveNumberParam(params?.id);

  return (
    <AppLayout title={copy.orderDetail.title}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {orderId ? (
          <ReferralOrderDetailScreen orderId={orderId} lang={lang} />
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              {copy.orderDetail.loadFailed}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
