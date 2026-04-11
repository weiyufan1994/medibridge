import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { getReferralCopy } from "@/features/referrals/copy";
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
  const [selectedHospitalId, setSelectedHospitalId] = useState<number | null>(null);
  const [editingHospitalId, setEditingHospitalId] = useState<number | null>(null);
  const [hospitalNameZh, setHospitalNameZh] = useState("");
  const [hospitalNameEn, setHospitalNameEn] = useState("");
  const [cityZh, setCityZh] = useState("");
  const [cityEn, setCityEn] = useState("");
  const [hospitalIsActive, setHospitalIsActive] = useState(true);
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [contactHospitalId, setContactHospitalId] = useState<number | null>(null);
  const [contactDepartmentId, setContactDepartmentId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactRoleType, setContactRoleType] = useState("");
  const [contactLanguages, setContactLanguages] = useState("");
  const [contactTags, setContactTags] = useState("");
  const [avgResponseTime, setAvgResponseTime] = useState("");
  const [successRate, setSuccessRate] = useState("");
  const [contactIsActive, setContactIsActive] = useState(true);
  const [internalNotes, setInternalNotes] = useState("");

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
    if (!selectedHospitalId && hospitalsQuery.data && hospitalsQuery.data.length > 0) {
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
      resetContactForm();
      await refreshCatalog();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const updateHospitalActiveMutation = trpc.referrals.updateHospitalActive.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      await refreshCatalog();
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const updateContactActiveMutation = trpc.referrals.updateContactActive.useMutation({
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
      hospitalsQuery.data?.find(hospital => hospital.id === selectedHospitalId) ?? null,
    [hospitalsQuery.data, selectedHospitalId]
  );

  return (
    <Card className="rounded-3xl border-slate-200/80">
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
              <h3 className="text-sm font-semibold text-slate-900">
                {copy.admin.catalog.hospitals}
              </h3>
              <Button
                variant="outline"
                className="rounded-xl border-slate-200"
                onClick={resetHospitalForm}
              >
                {copy.admin.catalog.createHospital}
              </Button>
            </div>

            <div className="space-y-3">
              {hospitalsQuery.data && hospitalsQuery.data.length > 0 ? (
                hospitalsQuery.data.map(hospital => (
                  <div
                    key={hospital.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {getLocalizedText({ lang, value: hospital.name })}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getLocalizedText({ lang, value: hospital.city })}
                        </p>
                      </div>
                      <Badge
                        className={
                          hospital.isActive
                            ? "border-0 bg-emerald-100 text-emerald-700"
                            : "border-0 bg-slate-200 text-slate-700"
                        }
                      >
                        {hospital.isActive ? copy.common.active : copy.common.inactive}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200"
                        onClick={() => {
                          setSelectedHospitalId(hospital.id);
                          setContactHospitalId(hospital.id);
                          setEditingHospitalId(hospital.id);
                          setHospitalNameZh(hospital.name.zh);
                          setHospitalNameEn(hospital.name.en);
                          setCityZh(hospital.city.zh);
                          setCityEn(hospital.city.en);
                          setHospitalIsActive(hospital.isActive);
                        }}
                      >
                        {copy.common.edit}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200"
                        onClick={() => {
                          void updateHospitalActiveMutation.mutateAsync({
                            hospitalId: hospital.id,
                            isActive: !hospital.isActive,
                          });
                        }}
                      >
                        {hospital.isActive ? copy.common.inactive : copy.common.active}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {copy.admin.catalog.emptyHospitals}
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {editingHospitalId
                  ? copy.admin.catalog.editHospital
                  : copy.admin.catalog.createHospital}
              </p>
              <Input
                value={hospitalNameZh}
                onChange={event => setHospitalNameZh(event.target.value)}
                placeholder={copy.admin.catalog.nameZh}
              />
              <Input
                value={hospitalNameEn}
                onChange={event => setHospitalNameEn(event.target.value)}
                placeholder={copy.admin.catalog.nameEn}
              />
              <Input
                value={cityZh}
                onChange={event => setCityZh(event.target.value)}
                placeholder={copy.admin.catalog.cityZh}
              />
              <Input
                value={cityEn}
                onChange={event => setCityEn(event.target.value)}
                placeholder={copy.admin.catalog.cityEn}
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={hospitalIsActive}
                  onChange={event => setHospitalIsActive(event.target.checked)}
                />
                {copy.admin.catalog.activeState}
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  disabled={
                    upsertHospitalMutation.isPending || hospitalNameZh.trim().length < 1
                  }
                  onClick={() => {
                    void upsertHospitalMutation.mutateAsync({
                      id: editingHospitalId ?? undefined,
                      name: hospitalNameZh.trim(),
                      nameEn: hospitalNameEn.trim() || undefined,
                      city: cityZh.trim() || undefined,
                      cityEn: cityEn.trim() || undefined,
                      isActive: hospitalIsActive,
                    });
                  }}
                >
                  {copy.admin.catalog.saveHospital}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200"
                  onClick={resetHospitalForm}
                >
                  {copy.common.cancel}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                {copy.admin.catalog.contacts}
              </h3>
              <div className="flex items-center gap-3">
                <select
                  className="h-9 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
                  value={selectedHospitalId ?? ""}
                  onChange={event => {
                    const next = Number(event.target.value);
                    setSelectedHospitalId(Number.isInteger(next) && next > 0 ? next : null);
                    setContactHospitalId(Number.isInteger(next) && next > 0 ? next : null);
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
                  className="rounded-xl border-slate-200"
                  onClick={resetContactForm}
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
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {contact.name}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {contact.roleType}
                        </p>
                      </div>
                      <Badge
                        className={
                          contact.isActive
                            ? "border-0 bg-emerald-100 text-emerald-700"
                            : "border-0 bg-slate-200 text-slate-700"
                        }
                      >
                        {contact.isActive ? copy.common.active : copy.common.inactive}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {contact.languages.join(", ") || copy.common.notAvailable}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200"
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
                        }}
                      >
                        {copy.common.edit}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200"
                        onClick={() => {
                          void updateContactActiveMutation.mutateAsync({
                            contactId: contact.id,
                            isActive: !contact.isActive,
                          });
                        }}
                      >
                        {contact.isActive ? copy.common.inactive : copy.common.active}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {copy.admin.catalog.emptyContacts}
                </p>
              )}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {editingContactId
                  ? copy.admin.catalog.editContact
                  : copy.admin.catalog.createContact}
              </p>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={contactHospitalId ?? ""}
                onChange={event => {
                  const next = Number(event.target.value);
                  setContactHospitalId(Number.isInteger(next) && next > 0 ? next : null);
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
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={contactDepartmentId ?? ""}
                onChange={event => {
                  const next = Number(event.target.value);
                  setContactDepartmentId(Number.isInteger(next) && next > 0 ? next : null);
                }}
              >
                <option value="">{copy.admin.catalog.department}</option>
                {(departmentsQuery.data ?? []).map(department => (
                  <option key={department.id} value={department.id}>
                    {getLocalizedText({ lang, value: department.name })}
                  </option>
                ))}
              </select>
              <Input
                value={contactName}
                onChange={event => setContactName(event.target.value)}
                placeholder={copy.admin.catalog.contactName}
              />
              <Input
                value={contactRoleType}
                onChange={event => setContactRoleType(event.target.value)}
                placeholder={copy.admin.catalog.roleType}
              />
              <Input
                value={contactLanguages}
                onChange={event => setContactLanguages(event.target.value)}
                placeholder={copy.admin.catalog.languages}
              />
              <Input
                value={contactTags}
                onChange={event => setContactTags(event.target.value)}
                placeholder={copy.admin.catalog.specialtyTags}
              />
              <Input
                value={avgResponseTime}
                onChange={event => setAvgResponseTime(event.target.value)}
                placeholder={copy.admin.catalog.avgResponseTime}
              />
              <Input
                value={successRate}
                onChange={event => setSuccessRate(event.target.value)}
                placeholder={copy.admin.catalog.successRate}
              />
              <Textarea
                value={internalNotes}
                onChange={event => setInternalNotes(event.target.value)}
                placeholder={copy.admin.catalog.internalNotes}
                className="min-h-[108px]"
              />
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={contactIsActive}
                  onChange={event => setContactIsActive(event.target.checked)}
                />
                {copy.admin.catalog.activeState}
              </label>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="rounded-xl bg-teal-600 text-white hover:bg-teal-700"
                  disabled={
                    upsertContactMutation.isPending ||
                    !contactHospitalId ||
                    !contactDepartmentId ||
                    contactName.trim().length < 1 ||
                    contactRoleType.trim().length < 1
                  }
                  onClick={() => {
                    void upsertContactMutation.mutateAsync({
                      id: editingContactId ?? undefined,
                      hospitalId: contactHospitalId!,
                      departmentId: contactDepartmentId!,
                      name: contactName.trim(),
                      roleType: contactRoleType.trim(),
                      languages: splitListInput(contactLanguages),
                      specialtyTags: splitListInput(contactTags),
                      avgResponseTimeMinutes: avgResponseTime.trim()
                        ? Number(avgResponseTime)
                        : undefined,
                      successRate: successRate.trim()
                        ? Number(successRate)
                        : undefined,
                      isActive: contactIsActive,
                      internalNotes: internalNotes.trim() || undefined,
                    });
                  }}
                >
                  {copy.admin.catalog.saveContact}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200"
                  onClick={resetContactForm}
                >
                  {copy.common.cancel}
                </Button>
              </div>
            </div>

            {selectedHospital ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {getLocalizedText({ lang, value: selectedHospital.name })}
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
