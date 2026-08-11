import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UseReferralCatalogControllerResult } from "@/features/admin/hooks/useReferralCatalogController";
import { getLocalizedText } from "@/lib/i18n";

type ReferralCatalogListsProps = {
  catalog: UseReferralCatalogControllerResult;
};

export function ReferralCatalogLists({ catalog }: ReferralCatalogListsProps) {
  const { copy, lang } = catalog;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {copy.admin.catalog.hospitals}
          </h3>
          <Button
            variant="outline"
            className="rounded-xl border-admin-border"
            onClick={catalog.openNewHospitalEditor}
          >
            {copy.admin.catalog.createHospital}
          </Button>
        </div>

        <div className="space-y-3">
          {catalog.hospitalsQuery.data &&
          catalog.hospitalsQuery.data.length > 0 ? (
            catalog.hospitalsQuery.data.map(hospital => (
              <div
                key={hospital.id}
                className="rounded-xl border border-admin-border bg-admin-surface-muted p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {getLocalizedText({ lang, value: hospital.name })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getLocalizedText({ lang, value: hospital.city })}
                    </p>
                  </div>
                  <Badge
                    className={
                      hospital.isActive
                        ? "border-0 bg-emerald-100 text-emerald-700"
                        : "border-0 bg-muted text-muted-foreground"
                    }
                  >
                    {hospital.isActive
                      ? copy.common.active
                      : copy.common.inactive}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="rounded-xl border-admin-border"
                    onClick={() => catalog.openHospitalEditor(hospital)}
                  >
                    {copy.common.edit}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-admin-border"
                    onClick={() => {
                      void catalog.updateHospitalActiveMutation.mutateAsync({
                        hospitalId: hospital.id,
                        isActive: !hospital.isActive,
                      });
                    }}
                  >
                    {hospital.isActive
                      ? copy.common.inactive
                      : copy.common.active}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {copy.admin.catalog.emptyHospitals}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            {copy.admin.catalog.contacts}
          </h3>
          <div className="flex items-center gap-3">
            <select
              className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
              value={catalog.selectedHospitalId ?? ""}
              onChange={event => catalog.selectHospital(event.target.value)}
            >
              {(catalog.hospitalsQuery.data ?? []).map(hospital => (
                <option key={hospital.id} value={hospital.id}>
                  {getLocalizedText({ lang, value: hospital.name })}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              className="rounded-xl border-admin-border"
              onClick={catalog.openNewContactEditor}
            >
              {copy.admin.catalog.createContact}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {catalog.contactsQuery.data &&
          catalog.contactsQuery.data.length > 0 ? (
            catalog.contactsQuery.data.map(contact => (
              <div
                key={contact.id}
                className="rounded-xl border border-admin-border bg-admin-surface-muted p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {contact.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {contact.roleType}
                    </p>
                  </div>
                  <Badge
                    className={
                      contact.isActive
                        ? "border-0 bg-emerald-100 text-emerald-700"
                        : "border-0 bg-muted text-muted-foreground"
                    }
                  >
                    {contact.isActive
                      ? copy.common.active
                      : copy.common.inactive}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {contact.languages.join(", ") || copy.common.notAvailable}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="rounded-xl border-admin-border"
                    onClick={() => catalog.openContactEditor(contact)}
                  >
                    {copy.common.edit}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-admin-border"
                    onClick={() => {
                      void catalog.updateContactActiveMutation.mutateAsync({
                        contactId: contact.id,
                        isActive: !contact.isActive,
                      });
                    }}
                  >
                    {contact.isActive
                      ? copy.common.inactive
                      : copy.common.active}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {copy.admin.catalog.emptyContacts}
            </p>
          )}
        </div>

        {catalog.selectedHospital ? (
          <div className="rounded-xl border border-admin-border bg-admin-surface-muted p-4 text-sm text-muted-foreground">
            {getLocalizedText({
              lang,
              value: catalog.selectedHospital.name,
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
