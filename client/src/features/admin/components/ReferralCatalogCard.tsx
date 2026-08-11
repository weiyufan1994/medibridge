import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { getReferralCopy } from "@/features/referrals";
import { getLocalizedText } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";

function splitListInput(value: string) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export function ReferralCatalogCard() {
  const { resolved } = useLanguage();
  const lang = resolved as "en" | "zh";
  const copy = getReferralCopy(lang);
  const utils = trpc.useUtils();
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(
    null
  );
  const [editingHospitalId, setEditingHospitalId] = useState<number | null>(
    null
  );
  const [hospitalNameZh, setHospitalNameZh] = useState("");
  const [hospitalNameEn, setHospitalNameEn] = useState("");
  const [cityZh, setCityZh] = useState("");
  const [cityEn, setCityEn] = useState("");
  const [hospitalIsActive, setHospitalIsActive] = useState(true);
  const [hospitalEditorOpen, setHospitalEditorOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactHospitalId, setContactHospitalId] = useState<number | null>(
    null
  );
  const [contactDepartmentId, setContactDepartmentId] = useState<number | null>(
    null
  );
  const [contactName, setContactName] = useState("");
  const [contactRoleType, setContactRoleType] = useState("");
  const [contactLanguages, setContactLanguages] = useState("");
  const [contactTags, setContactTags] = useState("");
  const [avgResponseTime, setAvgResponseTime] = useState("");
  const [successRate, setSuccessRate] = useState("");
  const [contactIsActive, setContactIsActive] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");
  const [contactEditorOpen, setContactEditorOpen] = useState(false);

  const hospitalsQuery = trpc.referrals.listHospitalsForAdmin.useQuery();
  const contactsQuery = trpc.referrals.listContactsForAdmin.useQuery({
    hospitalId: selectedHospitalId ?? undefined,
  });
  const departmentsQuery = trpc.referrals.listDepartmentsForAdmin.useQuery(
    {
      hospitalId: contactHospitalId ?? selectedHospitalId ?? 0,
    },
    {
      enabled: Boolean(contactHospitalId ?? selectedHospitalId),
    }
  );

  useEffect(() => {
    if (
      !selectedHospitalId &&
      hospitalsQuery.data &&
      hospitalsQuery.data.length > 0
    ) {
      setSelectedHospitalId(hospitalsQuery.data[0].id);
      setContactHospitalId(hospitalsQuery.data[0].id);
    }
  }, [hospitalsQuery.data, selectedHospitalId]);

  async function refreshCatalog() {
    await Promise.all([
      utils.referrals.listHospitalsForAdmin.invalidate(),
      utils.referrals.listContactsForAdmin.invalidate(),
      selectedHospitalId
        ? utils.referrals.listDepartmentsForAdmin.invalidate({
            hospitalId: selectedHospitalId,
          })
        : Promise.resolve(),
    ]);
  }

  function resetHospitalForm() {
    setEditingHospitalId(null);
    setHospitalNameZh("");
    setHospitalNameEn("");
    setCityZh("");
    setCityEn("");
    setHospitalIsActive(true);
  }

  function resetContactForm() {
    setEditingContactId(null);
    setContactDepartmentId(null);
    setContactName("");
    setContactRoleType("");
    setContactLanguages("");
    setContactTags("");
    setAvgResponseTime("");
    setSuccessRate("");
    setContactIsActive(true);
    setInternalNotes("");
  }

  const upsertHospitalMutation = trpc.referrals.upsertHospital.useMutation({
    onSuccess: async hospital => {
      toast.success(copy.admin.actionSuccess);
      setSelectedHospitalId(hospital.id);
      setContactHospitalId(hospital.id);
      setHospitalEditorOpen(false);
      resetHospitalForm();
      await refreshCatalog();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const upsertContactMutation = trpc.referrals.upsertContact.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setContactEditorOpen(false);
      resetContactForm();
      await refreshCatalog();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const updateHospitalActiveMutation =
    trpc.referrals.updateHospitalActive.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshCatalog();
      },
      onError: error => {
        toast.error(error.message);
      },
    });

  const updateContactActiveMutation =
    trpc.referrals.updateContactActive.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshCatalog();
      },
      onError: error => {
        toast.error(error.message);
      },
    });

  const selectedHospital = useMemo(
    () =>
      hospitalsQuery.data?.find(
        hospital => hospital.id === selectedHospitalId
      ) ?? null,
    [hospitalsQuery.data, selectedHospitalId]
  );

  function openNewHospitalEditor() {
    resetHospitalForm();
    setHospitalEditorOpen(true);
  }

  function openNewContactEditor() {
    resetContactForm();
    setContactHospitalId(selectedHospitalId);
    setContactEditorOpen(true);
  }

  async function saveHospital() {
    await upsertHospitalMutation.mutateAsync({
      id: editingHospitalId ?? undefined,
      name: hospitalNameZh.trim(),
      nameEn: hospitalNameEn.trim() || undefined,
      city: cityZh.trim() || undefined,
      cityEn: cityEn.trim() || undefined,
      isActive: hospitalIsActive,
    });
  }

  async function saveContact() {
    if (!contactHospitalId || !contactDepartmentId) {
      return;
    }

    await upsertContactMutation.mutateAsync({
      id: editingContactId ?? undefined,
      hospitalId: contactHospitalId,
      departmentId: contactDepartmentId,
      name: contactName.trim(),
      roleType: contactRoleType.trim(),
      languages: splitListInput(contactLanguages),
      specialtyTags: splitListInput(contactTags),
      avgResponseTimeMinutes: avgResponseTime.trim()
        ? Number(avgResponseTime)
        : undefined,
      successRate: successRate.trim() ? Number(successRate) : undefined,
      isActive: contactIsActive,
      internalNotes: internalNotes.trim() || undefined,
    });
  }

  return (
    <>
      <Card className="rounded-xl border-admin-border shadow-none">
        <CardHeader>
          <CardTitle>{copy.admin.catalog.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.admin.catalog.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  {copy.admin.catalog.hospitals}
                </h3>
                <Button
                  variant="outline"
                  className="rounded-xl border-admin-border"
                  onClick={openNewHospitalEditor}
                >
                  {copy.admin.catalog.createHospital}
                </Button>
              </div>

              <div className="space-y-3">
                {hospitalsQuery.data && hospitalsQuery.data.length > 0 ? (
                  hospitalsQuery.data.map(hospital => (
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
                          onClick={() => {
                            setSelectedHospitalId(hospital.id);
                            setContactHospitalId(hospital.id);
                            setEditingHospitalId(hospital.id);
                            setHospitalNameZh(hospital.name.zh);
                            setHospitalNameEn(hospital.name.en);
                            setCityZh(hospital.city.zh);
                            setCityEn(hospital.city.en);
                            setHospitalIsActive(hospital.isActive);
                            setHospitalEditorOpen(true);
                          }}
                        >
                          {copy.common.edit}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl border-admin-border"
                          onClick={() => {
                            void updateHospitalActiveMutation.mutateAsync({
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
                    value={selectedHospitalId ?? ""}
                    onChange={event => {
                      const next = Number(event.target.value);
                      setSelectedHospitalId(
                        Number.isInteger(next) && next > 0 ? next : null
                      );
                      setContactHospitalId(
                        Number.isInteger(next) && next > 0 ? next : null
                      );
                    }}
                  >
                    {(hospitalsQuery.data ?? []).map(hospital => (
                      <option key={hospital.id} value={hospital.id}>
                        {getLocalizedText({ lang, value: hospital.name })}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    className="rounded-xl border-admin-border"
                    onClick={openNewContactEditor}
                  >
                    {copy.admin.catalog.createContact}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {contactsQuery.data && contactsQuery.data.length > 0 ? (
                  contactsQuery.data.map(contact => (
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
                        {contact.languages.join(", ") ||
                          copy.common.notAvailable}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Button
                          variant="outline"
                          className="rounded-xl border-admin-border"
                          onClick={() => {
                            setEditingContactId(contact.id);
                            setContactHospitalId(contact.hospitalId);
                            setSelectedHospitalId(contact.hospitalId);
                            setContactDepartmentId(contact.departmentId);
                            setContactName(contact.name);
                            setContactRoleType(contact.roleType);
                            setContactLanguages(contact.languages.join(", "));
                            setContactTags(contact.specialtyTags.join(", "));
                            setAvgResponseTime(
                              contact.avgResponseTimeMinutes
                                ? String(contact.avgResponseTimeMinutes)
                                : ""
                            );
                            setSuccessRate(
                              typeof contact.successRate === "number"
                                ? String(contact.successRate)
                                : ""
                            );
                            setContactIsActive(contact.isActive);
                            setContactEditorOpen(true);
                          }}
                        >
                          {copy.common.edit}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl border-admin-border"
                          onClick={() => {
                            void updateContactActiveMutation.mutateAsync({
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

              {selectedHospital ? (
                <div className="rounded-xl border border-admin-border bg-admin-surface-muted p-4 text-sm text-muted-foreground">
                  {getLocalizedText({ lang, value: selectedHospital.name })}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={hospitalEditorOpen}
        onOpenChange={open => {
          if (upsertHospitalMutation.isPending) {
            return;
          }
          setHospitalEditorOpen(open);
          if (!open) {
            resetHospitalForm();
          }
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>
              {editingHospitalId
                ? copy.admin.catalog.editHospital
                : copy.admin.catalog.createHospital}
            </SheetTitle>
            <SheetDescription>
              {copy.admin.catalog.description}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-name-zh">
                {copy.admin.catalog.nameZh}
              </Label>
              <Input
                id="catalog-hospital-name-zh"
                value={hospitalNameZh}
                onChange={event => setHospitalNameZh(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-name-en">
                {copy.admin.catalog.nameEn}
              </Label>
              <Input
                id="catalog-hospital-name-en"
                value={hospitalNameEn}
                onChange={event => setHospitalNameEn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-city-zh">
                {copy.admin.catalog.cityZh}
              </Label>
              <Input
                id="catalog-hospital-city-zh"
                value={cityZh}
                onChange={event => setCityZh(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-city-en">
                {copy.admin.catalog.cityEn}
              </Label>
              <Input
                id="catalog-hospital-city-en"
                value={cityEn}
                onChange={event => setCityEn(event.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={hospitalIsActive}
                onChange={event => setHospitalIsActive(event.target.checked)}
              />
              {copy.admin.catalog.activeState}
            </label>
          </div>
          <SheetFooter className="border-t border-border px-5 py-4">
            <Button
              variant="outline"
              disabled={upsertHospitalMutation.isPending}
              onClick={() => setHospitalEditorOpen(false)}
            >
              {copy.common.cancel}
            </Button>
            <Button
              disabled={
                upsertHospitalMutation.isPending ||
                hospitalNameZh.trim().length < 1
              }
              onClick={() => void saveHospital()}
            >
              {copy.admin.catalog.saveHospital}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={contactEditorOpen}
        onOpenChange={open => {
          if (upsertContactMutation.isPending) {
            return;
          }
          setContactEditorOpen(open);
          if (!open) {
            resetContactForm();
          }
        }}
      >
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>
              {editingContactId
                ? copy.admin.catalog.editContact
                : copy.admin.catalog.createContact}
            </SheetTitle>
            <SheetDescription>
              {copy.admin.catalog.description}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-hospital">
                {copy.admin.catalog.selectedHospital}
              </Label>
              <select
                id="catalog-contact-hospital"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={contactHospitalId ?? ""}
                onChange={event => {
                  const next = Number(event.target.value);
                  setContactHospitalId(
                    Number.isInteger(next) && next > 0 ? next : null
                  );
                  setContactDepartmentId(null);
                }}
              >
                <option value="">{copy.admin.catalog.selectedHospital}</option>
                {(hospitalsQuery.data ?? []).map(hospital => (
                  <option key={hospital.id} value={hospital.id}>
                    {getLocalizedText({ lang, value: hospital.name })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-department">
                {copy.admin.catalog.department}
              </Label>
              <select
                id="catalog-contact-department"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={contactDepartmentId ?? ""}
                onChange={event => {
                  const next = Number(event.target.value);
                  setContactDepartmentId(
                    Number.isInteger(next) && next > 0 ? next : null
                  );
                }}
              >
                <option value="">{copy.admin.catalog.department}</option>
                {(departmentsQuery.data ?? []).map(department => (
                  <option key={department.id} value={department.id}>
                    {getLocalizedText({ lang, value: department.name })}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-name">
                {copy.admin.catalog.contactName}
              </Label>
              <Input
                id="catalog-contact-name"
                value={contactName}
                onChange={event => setContactName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-role">
                {copy.admin.catalog.roleType}
              </Label>
              <Input
                id="catalog-contact-role"
                value={contactRoleType}
                onChange={event => setContactRoleType(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-languages">
                  {copy.admin.catalog.languages}
                </Label>
                <Input
                  id="catalog-contact-languages"
                  value={contactLanguages}
                  onChange={event => setContactLanguages(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-tags">
                  {copy.admin.catalog.specialtyTags}
                </Label>
                <Input
                  id="catalog-contact-tags"
                  value={contactTags}
                  onChange={event => setContactTags(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-response-time">
                  {copy.admin.catalog.avgResponseTime}
                </Label>
                <Input
                  id="catalog-contact-response-time"
                  inputMode="numeric"
                  value={avgResponseTime}
                  onChange={event => setAvgResponseTime(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-success-rate">
                  {copy.admin.catalog.successRate}
                </Label>
                <Input
                  id="catalog-contact-success-rate"
                  inputMode="decimal"
                  value={successRate}
                  onChange={event => setSuccessRate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-notes">
                {copy.admin.catalog.internalNotes}
              </Label>
              <Textarea
                id="catalog-contact-notes"
                value={internalNotes}
                onChange={event => setInternalNotes(event.target.value)}
                className="min-h-[108px]"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={contactIsActive}
                onChange={event => setContactIsActive(event.target.checked)}
              />
              {copy.admin.catalog.activeState}
            </label>
          </div>
          <SheetFooter className="border-t border-border px-5 py-4">
            <Button
              variant="outline"
              disabled={upsertContactMutation.isPending}
              onClick={() => setContactEditorOpen(false)}
            >
              {copy.common.cancel}
            </Button>
            <Button
              disabled={
                upsertContactMutation.isPending ||
                !contactHospitalId ||
                !contactDepartmentId ||
                contactName.trim().length < 1 ||
                contactRoleType.trim().length < 1
              }
              onClick={() => void saveContact()}
            >
              {copy.admin.catalog.saveContact}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
