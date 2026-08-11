import { Button } from "@/components/ui/button";
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
import type { UseReferralCatalogControllerResult } from "@/features/admin/hooks/useReferralCatalogController";
import { getLocalizedText } from "@/lib/i18n";

type ReferralCatalogEditorsProps = {
  catalog: UseReferralCatalogControllerResult;
};

export function ReferralCatalogEditors({
  catalog,
}: ReferralCatalogEditorsProps) {
  const { copy, lang } = catalog;

  return (
    <>
      <Sheet
        open={catalog.hospitalEditorOpen}
        onOpenChange={catalog.onHospitalEditorOpenChange}
      >
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>
              {catalog.editingHospitalId
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
                value={catalog.hospitalNameZh}
                onChange={event =>
                  catalog.setHospitalNameZh(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-name-en">
                {copy.admin.catalog.nameEn}
              </Label>
              <Input
                id="catalog-hospital-name-en"
                value={catalog.hospitalNameEn}
                onChange={event =>
                  catalog.setHospitalNameEn(event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-city-zh">
                {copy.admin.catalog.cityZh}
              </Label>
              <Input
                id="catalog-hospital-city-zh"
                value={catalog.cityZh}
                onChange={event => catalog.setCityZh(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-hospital-city-en">
                {copy.admin.catalog.cityEn}
              </Label>
              <Input
                id="catalog-hospital-city-en"
                value={catalog.cityEn}
                onChange={event => catalog.setCityEn(event.target.value)}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={catalog.hospitalIsActive}
                onChange={event =>
                  catalog.setHospitalIsActive(event.target.checked)
                }
              />
              {copy.admin.catalog.activeState}
            </label>
          </div>
          <SheetFooter className="border-t border-border px-5 py-4">
            <Button
              variant="outline"
              disabled={catalog.upsertHospitalMutation.isPending}
              onClick={() => catalog.setHospitalEditorOpen(false)}
            >
              {copy.common.cancel}
            </Button>
            <Button
              disabled={
                catalog.upsertHospitalMutation.isPending ||
                catalog.hospitalNameZh.trim().length < 1
              }
              onClick={() => void catalog.saveHospital()}
            >
              {copy.admin.catalog.saveHospital}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet
        open={catalog.contactEditorOpen}
        onOpenChange={catalog.onContactEditorOpenChange}
      >
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle>
              {catalog.editingContactId
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
                value={catalog.contactHospitalId ?? ""}
                onChange={event =>
                  catalog.onContactHospitalChange(event.target.value)
                }
              >
                <option value="">{copy.admin.catalog.selectedHospital}</option>
                {(catalog.hospitalsQuery.data ?? []).map(hospital => (
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
                value={catalog.contactDepartmentId ?? ""}
                onChange={event =>
                  catalog.onContactDepartmentChange(event.target.value)
                }
              >
                <option value="">{copy.admin.catalog.department}</option>
                {(catalog.departmentsQuery.data ?? []).map(department => (
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
                value={catalog.contactName}
                onChange={event => catalog.setContactName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-role">
                {copy.admin.catalog.roleType}
              </Label>
              <Input
                id="catalog-contact-role"
                value={catalog.contactRoleType}
                onChange={event =>
                  catalog.setContactRoleType(event.target.value)
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-languages">
                  {copy.admin.catalog.languages}
                </Label>
                <Input
                  id="catalog-contact-languages"
                  value={catalog.contactLanguages}
                  onChange={event =>
                    catalog.setContactLanguages(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-tags">
                  {copy.admin.catalog.specialtyTags}
                </Label>
                <Input
                  id="catalog-contact-tags"
                  value={catalog.contactTags}
                  onChange={event => catalog.setContactTags(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-response-time">
                  {copy.admin.catalog.avgResponseTime}
                </Label>
                <Input
                  id="catalog-contact-response-time"
                  inputMode="numeric"
                  value={catalog.avgResponseTime}
                  onChange={event =>
                    catalog.setAvgResponseTime(event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-contact-success-rate">
                  {copy.admin.catalog.successRate}
                </Label>
                <Input
                  id="catalog-contact-success-rate"
                  inputMode="decimal"
                  value={catalog.successRate}
                  onChange={event => catalog.setSuccessRate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-contact-notes">
                {copy.admin.catalog.internalNotes}
              </Label>
              <Textarea
                id="catalog-contact-notes"
                value={catalog.internalNotes}
                onChange={event => catalog.setInternalNotes(event.target.value)}
                className="min-h-[108px]"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={catalog.contactIsActive}
                onChange={event =>
                  catalog.setContactIsActive(event.target.checked)
                }
              />
              {copy.admin.catalog.activeState}
            </label>
          </div>
          <SheetFooter className="border-t border-border px-5 py-4">
            <Button
              variant="outline"
              disabled={catalog.upsertContactMutation.isPending}
              onClick={() => catalog.setContactEditorOpen(false)}
            >
              {copy.common.cancel}
            </Button>
            <Button
              disabled={
                catalog.upsertContactMutation.isPending ||
                !catalog.contactHospitalId ||
                !catalog.contactDepartmentId ||
                catalog.contactName.trim().length < 1 ||
                catalog.contactRoleType.trim().length < 1
              }
              onClick={() => void catalog.saveContact()}
            >
              {copy.admin.catalog.saveContact}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
