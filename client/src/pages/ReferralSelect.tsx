import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { ReferralConfirmationScreen } from "@/features/referrals/components/ReferralConfirmationScreen";
import { getReferralCopy } from "@/features/referrals/copy";
import {
  parseNonNegativeNumberParam,
  parsePositiveNumberParam,
} from "@/features/referrals/presentation";

function readSelectionParams() {
  if (typeof window === "undefined") {
    return {
      triageSessionId: null,
      rankedHospitalIndex: null,
      hospitalId: null,
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    triageSessionId: parsePositiveNumberParam(params.get("triageSessionId")),
    rankedHospitalIndex: parseNonNegativeNumberParam(
      params.get("rankedHospitalIndex")
    ),
    hospitalId: parsePositiveNumberParam(params.get("hospitalId")),
  };
}

export default function ReferralSelectPage() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const { triageSessionId, rankedHospitalIndex, hospitalId } =
    readSelectionParams();

  return (
    <AppLayout title={copy.confirmation.title}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {triageSessionId &&
        (rankedHospitalIndex !== null || hospitalId !== null) ? (
          <ReferralConfirmationScreen
            triageSessionId={triageSessionId}
            rankedHospitalIndex={rankedHospitalIndex}
            hospitalId={hospitalId}
            lang={lang}
          />
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="p-6 text-sm text-muted-foreground">
              {copy.confirmation.loadFailed}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
