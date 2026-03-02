import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Stethoscope } from "lucide-react";
import { Loader2 } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorDetailContent } from "@/features/hospitals/components/DoctorDetailContent";
import { useDoctorDetail } from "@/features/hospitals/hooks/useDoctorDetail";
import { hospitalsCopy } from "@/features/hospitals/copy";

export default function DoctorDetail() {
  const [, params] = useRoute("/doctor/:id");
  const [, setLocation] = useLocation();
  const doctorId = params?.id ? parseInt(params.id) : 0;
  const { resolved } = useLanguage();

  const handleGoBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    setLocation("/hospitals");
  };

  const { data, isLoading, error } = useDoctorDetail(doctorId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
        <div className="container py-12">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">{hospitalsCopy.doctorDetail.notFound}</p>
              <Link href="/">
                <Button variant="link" className="mt-4">{hospitalsCopy.doctorDetail.backToHome}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Stethoscope className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">MediBridge</h1>
                <p className="text-sm text-muted-foreground">{hospitalsCopy.doctorDetail.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleGoBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {hospitalsCopy.doctorDetail.back}
              </Button>
              <LanguageSwitcher />
              <Link href="/">
                <Button variant="ghost" size="sm">
                  {hospitalsCopy.doctorDetail.backToHome}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <DoctorDetailContent data={data} resolved={resolved} />
      </div>
    </div>
  );
}
