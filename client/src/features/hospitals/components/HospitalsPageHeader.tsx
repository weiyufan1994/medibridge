import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import TopHeader from "@/components/layout/TopHeader";
import { getHospitalsCopy } from "@/features/hospitals/copy";

export function HospitalsPageHeader() {
  const { resolved } = useLanguage();
  const copy = getHospitalsCopy(resolved);

  return (
    <TopHeader subtitle={copy.pageHeader.subtitle}>
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-1">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {copy.pageHeader.backToHome}
        </Button>
      </Link>
    </TopHeader>
  );
}
