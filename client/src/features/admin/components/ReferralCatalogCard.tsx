import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useReferralCatalogController } from "@/features/admin/hooks/useReferralCatalogController";
import { ReferralCatalogEditors } from "./ReferralCatalogEditors";
import { ReferralCatalogLists } from "./ReferralCatalogLists";

export function ReferralCatalogCard() {
  const { resolved } = useLanguage();
  const catalog = useReferralCatalogController(resolved as "en" | "zh");

  return (
    <>
      <Card className="rounded-xl border-admin-border shadow-none">
        <CardHeader>
          <CardTitle>{catalog.copy.admin.catalog.title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {catalog.copy.admin.catalog.description}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <ReferralCatalogLists catalog={catalog} />
        </CardContent>
      </Card>
      <ReferralCatalogEditors catalog={catalog} />
    </>
  );
}
