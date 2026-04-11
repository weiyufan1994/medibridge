import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getLocalizedText } from "@/lib/i18n";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import {
  buildReferralPaymentHref,
  formatReferralMoney,
} from "@/features/referrals/presentation";
import {
  REFERRAL_SERVICE_AGREEMENT_VERSION,
  REFERRAL_SERVICE_AMOUNT,
  REFERRAL_SERVICE_CURRENCY,
} from "@shared/referrals";

type ReferralConfirmationScreenProps = {
  triageSessionId: number;
  rankedHospitalIndex: number | null;
  hospitalId: number | null;
  lang: ReferralLang;
};

export function ReferralConfirmationScreen({
  triageSessionId,
  rankedHospitalIndex,
  hospitalId,
  lang,
}: ReferralConfirmationScreenProps) {
  const copy = getReferralCopy(lang);
  const [, setLocation] = useLocation();
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const selectionQuery = trpc.referrals.getSelectionContext.useQuery({
    triageSessionId,
    rankedHospitalIndex: rankedHospitalIndex ?? undefined,
    hospitalId: hospitalId ?? undefined,
  });
  const createDraftMutation = trpc.referrals.createOrderDraft.useMutation({
    onSuccess: result => {
      setLocation(buildReferralPaymentHref(result.id));
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  if (selectionQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-40 rounded-3xl" />
      </div>
    );
  }

  if (selectionQuery.error || !selectionQuery.data) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {selectionQuery.error?.message || copy.confirmation.loadFailed}
        </CardContent>
      </Card>
    );
  }

  const context = selectionQuery.data;
  const hospitalName =
    getLocalizedText({ lang, value: context.hospital.name }).trim() ||
    copy.common.notAvailable;
  const departmentName =
    getLocalizedText({ lang, value: context.department.name }).trim() ||
    copy.common.notAvailable;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <CardTitle className="text-2xl">{copy.confirmation.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.confirmation.description}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.confirmation.hospital}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {hospitalName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {departmentName}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.confirmation.contact}
            </p>
            <p className="mt-2 text-base font-semibold text-slate-900">
              {copy.common.contactPending}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {copy.confirmation.fulfillmentDescription}
            </p>
          </div>
        </CardContent>
      </Card>

      {context.manualFulfillmentRequired ? (
        <Card className="rounded-3xl border-amber-200 bg-amber-50/70">
          <CardContent className="p-6 text-sm leading-6 text-amber-900">
            {copy.confirmation.manualHandlingNotice}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border-slate-200/80">
        <CardContent className="space-y-5 p-6">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {copy.confirmation.serviceDescription}
            </p>
          </div>

          {context.recommendationReason ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">
                {copy.orderDetail.recommendationReason}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {context.recommendationReason}
              </p>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {copy.confirmation.priceLabel}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatReferralMoney({
                amount: REFERRAL_SERVICE_AMOUNT,
                currency: REFERRAL_SERVICE_CURRENCY,
                lang,
              })}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">
              {copy.confirmation.refundPolicyTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {copy.confirmation.refundPolicy}
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              {copy.confirmation.disclaimerTitle}
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              {copy.confirmation.disclaimer}
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4">
            <Checkbox
              id="referral-agreement"
              checked={agreementAccepted}
              onCheckedChange={checked => setAgreementAccepted(checked === true)}
            />
            <Label
              htmlFor="referral-agreement"
              className="text-sm leading-6 text-slate-700"
            >
              {copy.confirmation.agreementLabel}
            </Label>
          </div>

          <Button
            className="w-full rounded-xl bg-teal-600 text-white hover:bg-teal-700"
            disabled={createDraftMutation.isPending}
            onClick={() => {
              if (!agreementAccepted) {
                toast.error(copy.confirmation.agreementRequired);
                return;
              }
              void createDraftMutation.mutateAsync({
                triageSessionId,
                rankedHospitalIndex: rankedHospitalIndex ?? undefined,
                hospitalId: hospitalId ?? undefined,
                agreementAccepted: true,
                agreementVersion: REFERRAL_SERVICE_AGREEMENT_VERSION,
                agreementLang: lang,
              });
            }}
          >
            {createDraftMutation.isPending
              ? copy.payment.processing
              : copy.confirmation.continueToPayment}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
