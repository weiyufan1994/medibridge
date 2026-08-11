import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getReferralCopy, type ReferralLang } from "@/features/referrals";
import { trpc } from "@/lib/trpc";

type CatalogHospital = {
  id: number;
  name: { zh: string; en: string };
  city: { zh: string; en: string };
  isActive: boolean;
};

type CatalogContact = {
  id: number;
  hospitalId: number;
  departmentId: number;
  name: string;
  roleType: string;
  languages: string[];
  specialtyTags: string[];
  avgResponseTimeMinutes: number | null;
  successRate: number | null;
  isActive: boolean;
};

export function splitReferralCatalogListInput(value: string) {
  return value
    .split(",")
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export function useReferralCatalogController(lang: ReferralLang) {
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
    { hospitalId: contactHospitalId ?? selectedHospitalId ?? 0 },
    { enabled: Boolean(contactHospitalId ?? selectedHospitalId) }
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
    onError: error => toast.error(error.message),
  });
  const upsertContactMutation = trpc.referrals.upsertContact.useMutation({
    onSuccess: async () => {
      toast.success(copy.admin.actionSuccess);
      setContactEditorOpen(false);
      resetContactForm();
      await refreshCatalog();
    },
    onError: error => toast.error(error.message),
  });
  const updateHospitalActiveMutation =
    trpc.referrals.updateHospitalActive.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshCatalog();
      },
      onError: error => toast.error(error.message),
    });
  const updateContactActiveMutation =
    trpc.referrals.updateContactActive.useMutation({
      onSuccess: async () => {
        toast.success(copy.admin.actionSuccess);
        await refreshCatalog();
      },
      onError: error => toast.error(error.message),
    });

  const selectedHospital = useMemo(
    () =>
      hospitalsQuery.data?.find(
        hospital => hospital.id === selectedHospitalId
      ) ?? null,
    [hospitalsQuery.data, selectedHospitalId]
  );

  function selectHospital(value: string) {
    const next = Number(value);
    const hospitalId = Number.isInteger(next) && next > 0 ? next : null;
    setSelectedHospitalId(hospitalId);
    setContactHospitalId(hospitalId);
  }

  function openNewHospitalEditor() {
    resetHospitalForm();
    setHospitalEditorOpen(true);
  }

  function openHospitalEditor(hospital: CatalogHospital) {
    setSelectedHospitalId(hospital.id);
    setContactHospitalId(hospital.id);
    setEditingHospitalId(hospital.id);
    setHospitalNameZh(hospital.name.zh);
    setHospitalNameEn(hospital.name.en);
    setCityZh(hospital.city.zh);
    setCityEn(hospital.city.en);
    setHospitalIsActive(hospital.isActive);
    setHospitalEditorOpen(true);
  }

  function openNewContactEditor() {
    resetContactForm();
    setContactHospitalId(selectedHospitalId);
    setContactEditorOpen(true);
  }

  function openContactEditor(contact: CatalogContact) {
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
      typeof contact.successRate === "number" ? String(contact.successRate) : ""
    );
    setContactIsActive(contact.isActive);
    setContactEditorOpen(true);
  }

  function onHospitalEditorOpenChange(open: boolean) {
    if (upsertHospitalMutation.isPending) return;
    setHospitalEditorOpen(open);
    if (!open) resetHospitalForm();
  }

  function onContactEditorOpenChange(open: boolean) {
    if (upsertContactMutation.isPending) return;
    setContactEditorOpen(open);
    if (!open) resetContactForm();
  }

  function onContactHospitalChange(value: string) {
    const next = Number(value);
    setContactHospitalId(Number.isInteger(next) && next > 0 ? next : null);
    setContactDepartmentId(null);
  }

  function onContactDepartmentChange(value: string) {
    const next = Number(value);
    setContactDepartmentId(Number.isInteger(next) && next > 0 ? next : null);
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
    if (!contactHospitalId || !contactDepartmentId) return;
    await upsertContactMutation.mutateAsync({
      id: editingContactId ?? undefined,
      hospitalId: contactHospitalId,
      departmentId: contactDepartmentId,
      name: contactName.trim(),
      roleType: contactRoleType.trim(),
      languages: splitReferralCatalogListInput(contactLanguages),
      specialtyTags: splitReferralCatalogListInput(contactTags),
      avgResponseTimeMinutes: avgResponseTime.trim()
        ? Number(avgResponseTime)
        : undefined,
      successRate: successRate.trim() ? Number(successRate) : undefined,
      isActive: contactIsActive,
      internalNotes: internalNotes.trim() || undefined,
    });
  }

  return {
    copy,
    lang,
    selectedHospitalId,
    selectedHospital,
    editingHospitalId,
    hospitalNameZh,
    setHospitalNameZh,
    hospitalNameEn,
    setHospitalNameEn,
    cityZh,
    setCityZh,
    cityEn,
    setCityEn,
    hospitalIsActive,
    setHospitalIsActive,
    hospitalEditorOpen,
    editingContactId,
    contactHospitalId,
    contactDepartmentId,
    contactName,
    setContactName,
    contactRoleType,
    setContactRoleType,
    contactLanguages,
    setContactLanguages,
    contactTags,
    setContactTags,
    avgResponseTime,
    setAvgResponseTime,
    successRate,
    setSuccessRate,
    contactIsActive,
    setContactIsActive,
    internalNotes,
    setInternalNotes,
    contactEditorOpen,
    hospitalsQuery,
    contactsQuery,
    departmentsQuery,
    upsertHospitalMutation,
    upsertContactMutation,
    updateHospitalActiveMutation,
    updateContactActiveMutation,
    selectHospital,
    openNewHospitalEditor,
    openHospitalEditor,
    openNewContactEditor,
    openContactEditor,
    onHospitalEditorOpenChange,
    onContactEditorOpenChange,
    onContactHospitalChange,
    onContactDepartmentChange,
    setHospitalEditorOpen,
    setContactEditorOpen,
    saveHospital,
    saveContact,
  };
}

export type UseReferralCatalogControllerResult = ReturnType<
  typeof useReferralCatalogController
>;
