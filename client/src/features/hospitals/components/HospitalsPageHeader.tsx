import { Link } from "wouter";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHospitalsCopy } from "@/features/hospitals/copy";

export function HospitalsPageHeader() {
  const { resolved } = useLanguage();
  const copy = getHospitalsCopy(resolved);

  return (
    <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="container py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MediBridge</h1>
              <p className="text-sm text-muted-foreground">{copy.pageHeader.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                {copy.pageHeader.backToHome}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
