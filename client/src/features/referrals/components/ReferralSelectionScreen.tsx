import { Building2, Clock3, Languages, Tags } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { getLocalizedText } from "@/lib/i18n";
import { getReferralCopy, type ReferralLang } from "@/features/referrals/copy";
import { buildReferralConfirmationHref } from "@/features/referrals/presentation";

type ReferralSelectionScreenProps = {
  triageSessionId: number;
  hospitalId: number;
  lang: ReferralLang;
};

export function ReferralSelectionScreen({
  triageSessionId,
  hospitalId,
  lang,
}: ReferralSelectionScreenProps) {
  const [, setLocation] = useLocation();
  const copy = getReferralCopy(lang);
  const selectionQuery = trpc.referrals.getSelectionContext.useQuery({
    triageSessionId,
    hospitalId,
  });

  if (selectionQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </div>
    );
  }

  if (selectionQuery.error || !selectionQuery.data) {
    return (
      <Card className="rounded-3xl">
        <CardContent className="p-6 text-sm text-muted-foreground">
          {selectionQuery.error?.message || copy.selection.loadFailed}
        </CardContent>
      </Card>
    );
  }

  const context = selectionQuery.data;

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200/80">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-600">
            {copy.selection.eyebrow}
          </p>
          <CardTitle className="text-2xl">{copy.selection.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.selection.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Building2 className="h-4 w-4 text-teal-600" />
              {getLocalizedText({ lang, value: context.hospital.name })}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {getLocalizedText({ lang, value: context.hospital.city })}
            </p>
            {context.department ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {copy.selection.recommendedDepartment}
                </span>
                <Badge className="border-0 bg-teal-600 text-white">
                  {getLocalizedText({ lang, value: context.department.name })}
                </Badge>
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-900">
              {copy.selection.triageSummary}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {context.triageSummary || "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      {context.contacts.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-slate-300">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {copy.selection.noContacts}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {context.contacts.map(contact => (
            <Card key={contact.id} className="rounded-3xl border-slate-200/80">
              <CardContent className="grid gap-4 p-6 md:grid-cols-[1fr_auto] md:items-start">
                <div className="space-y-3">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">
                      {contact.name}
                    </p>
                    <p className="text-sm text-slate-500">{contact.roleType}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                    {contact.languages.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <Languages className="h-3.5 w-3.5" />
                        {copy.selection.contactLanguages}: {contact.languages.join(", ")}
                      </span>
                    ) : null}
                    {contact.specialtyTags.length > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <Tags className="h-3.5 w-3.5" />
                        {copy.selection.contactSpecialties}: {contact.specialtyTags.join(", ")}
                      </span>
                    ) : null}
                    {contact.avgResponseTimeMinutes ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {copy.selection.responseTime}: {contact.avgResponseTimeMinutes} min
                      </span>
                    ) : null}
                    {typeof contact.successRate === "number" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                        {copy.selection.successRate}: {contact.successRate}%
                      </span>
                    ) : null}
                  </div>
                </div>

                <Button
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  onClick={() =>
                    setLocation(
                      buildReferralConfirmationHref({
                        triageSessionId,
                        hospitalId,
                        contactId: contact.id,
                      })
                    )
                  }
                >
                  {copy.selection.chooseContact}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
