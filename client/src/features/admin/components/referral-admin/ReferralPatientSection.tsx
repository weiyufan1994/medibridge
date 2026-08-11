import { TabsContent } from "@/components/ui/tabs";
import { formatReferralMoney, getReferralCopy } from "@/features/referrals";
import { SectionBox } from "./ReferralAdminPrimitives";

type ReferralPatientSectionProps = {
  lang: "en" | "zh";
  patientEmail: string | null;
  hospitalName: string | undefined;
  departmentName: string | undefined;
  totalAmount: number | null;
  currency: string | null;
  triageSummary: string | null | undefined;
  recommendationReason: string | null | undefined;
};

export function ReferralPatientSection({
  lang,
  patientEmail,
  hospitalName,
  departmentName,
  totalAmount,
  currency,
  triageSummary,
  recommendationReason,
}: ReferralPatientSectionProps) {
  const copy = getReferralCopy(lang);

  return (
    <TabsContent value="patient" className="min-h-0 overflow-y-auto p-4">
      <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
        <SectionBox title={copy.admin.triageSummary}>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">
                {copy.admin.patient}:{" "}
              </span>
              {patientEmail ?? copy.common.notAvailable}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {copy.orderDetail.selectedHospital}:{" "}
              </span>
              {hospitalName}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {copy.selection.recommendedDepartment}:{" "}
              </span>
              {departmentName}
            </p>
            <p>
              <span className="font-medium text-foreground">
                {copy.orderDetail.serviceFee}:{" "}
              </span>
              {formatReferralMoney({
                amount: totalAmount ?? 0,
                currency: currency ?? "usd",
                lang,
              })}
            </p>
          </div>
          <div className="mt-3 rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm leading-6 text-foreground">
            {triageSummary || copy.common.notAvailable}
          </div>
        </SectionBox>

        <SectionBox title={copy.admin.recommendationReason}>
          <div className="rounded-lg border border-admin-border bg-admin-surface-muted px-3 py-3 text-sm leading-6 text-foreground">
            {recommendationReason || copy.common.notAvailable}
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-admin-border px-3 py-6 text-center text-sm text-muted-foreground">
            {copy.admin.detailTabs.patient}
          </div>
        </SectionBox>
      </div>
    </TabsContent>
  );
}
