import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Stethoscope, Hospital, ArrowRight, CheckCircle2 } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHomeCopy } from "@/features/home/copy";

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";

export default function Home() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, openLoginModal, logout } = useAuth();
  const { resolved } = useLanguage();
  const t = getHomeCopy(resolved);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISCLAIMER_KEY) === "1";
  });

  const goToTriagePage = () => {
    setLocation("/triage");
  };

  const handleAcceptDisclaimer = () => {
    setDisclaimerAccepted(true);
    localStorage.setItem(DISCLAIMER_KEY, "1");
    setDisclaimerOpen(false);
    goToTriagePage();
  };

  const handleQuickStart = () => {
    if (disclaimerAccepted) {
      goToTriagePage();
      return;
    }
    setDisclaimerOpen(true);
  };

  const handleStartConsultation = () => {
    if (disclaimerAccepted) {
      goToTriagePage();
      return;
    }
    setDisclaimerOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20">
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
                <Stethoscope className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">MediBridge</h1>
                <p className="text-sm text-muted-foreground">{t.brandSubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {!isAuthenticated ? (
                <Button variant="outline" size="sm" onClick={openLoginModal}>
                  {t.login}
                </Button>
              ) : (
                <>
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm">
                      {t.dashboard}
                    </Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => void logout()}>
                    {t.logout}
                  </Button>
                </>
              )}
              <Link href="/hospitals">
                <Button variant="ghost" size="sm">
                  <Hospital className="mr-2 h-4 w-4" />
                  {t.browseHospitals}
                </Button>
              </Link>
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <div className="container py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="h-10 w-10 text-primary" />
            </div>
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">{t.heroTitle}</h2>
            <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
              {t.heroDescription}
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" className="px-8 text-lg" onClick={handleStartConsultation}>
                {t.startConsultation}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/hospitals">
                <Button size="lg" variant="outline" className="px-8 text-lg">
                  {t.browseHospitals}
                </Button>
              </Link>
            </div>
          </div>

          <div className="mb-16 grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t.feature1Title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{t.feature1Description}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Hospital className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t.feature2Title}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-muted-foreground">{t.feature2Description}</p></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{t.feature3Title}</CardTitle>
              </CardHeader>
              <CardContent><p className="text-muted-foreground">{t.feature3Description}</p></CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card p-8">
            <h3 className="mb-8 text-center text-2xl font-bold">{t.howItWorks}</h3>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  1
                </div>
                <h4 className="mb-2 font-semibold">{t.step1Title}</h4>
                <p className="text-sm text-muted-foreground">{t.step1Description}</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  2
                </div>
                <h4 className="mb-2 font-semibold">{t.step2Title}</h4>
                <p className="text-sm text-muted-foreground">{t.step2Description}</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  3
                </div>
                <h4 className="mb-2 font-semibold">{t.step3Title}</h4>
                <p className="text-sm text-muted-foreground">{t.step3Description}</p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="mb-4 text-muted-foreground">{t.tryAsking}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                {t.tag1}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                {t.tag2}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                {t.tag3}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                {t.tag4}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.disclaimerTitle}</DialogTitle>
            <DialogDescription>{t.disclaimerDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>{t.disclaimerLine1}</p>
            <p>{t.disclaimerLine2}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisclaimerOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleAcceptDisclaimer}>{t.understand}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
