import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
import { useLanguage } from "@/contexts/LanguageContext";
import { getHomeCopy } from "@/features/home/copy";
import TopHeader from "@/components/layout/TopHeader";

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";

export default function Home() {
  const [, setLocation] = useLocation();
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
    <div className="min-h-screen bg-gradient-to-b from-teal-50/40 via-white to-slate-50">
      <TopHeader />

      <section className="px-6 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <div className="mx-auto inline-flex rounded-full bg-teal-50 p-3 text-teal-600">
              <Stethoscope className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl">
              {t.heroTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
              {t.heroDescription}
            </p>
            <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                size="lg"
                className="rounded-full bg-teal-600 px-8 py-3 text-lg font-medium text-white shadow-md shadow-teal-500/20 transition-all hover:bg-teal-700"
                onClick={handleStartConsultation}
              >
                {t.startConsultation}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/hospitals">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border border-slate-300 bg-white px-8 py-3 text-lg font-medium text-slate-700 transition-all hover:bg-slate-50"
                >
                  {t.browseHospitals}
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto mt-20 grid max-w-6xl grid-cols-1 gap-8 px-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 inline-flex rounded-xl bg-teal-50 p-3 text-teal-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">{t.feature1Title}</h3>
              <p className="leading-relaxed text-slate-600">{t.feature1Description}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 inline-flex rounded-xl bg-teal-50 p-3 text-teal-600">
                <Hospital className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">{t.feature2Title}</h3>
              <p className="leading-relaxed text-slate-600">{t.feature2Description}</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-left shadow-sm transition-shadow hover:shadow-md">
              <div className="mb-6 inline-flex rounded-xl bg-teal-50 p-3 text-teal-600">
                <Stethoscope className="h-6 w-6" />
              </div>
              <h3 className="mb-3 text-xl font-bold text-slate-900">{t.feature3Title}</h3>
              <p className="leading-relaxed text-slate-600">{t.feature3Description}</p>
            </div>
          </div>

          <div className="mt-16 rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
            <h3 className="mb-8 text-center text-2xl font-bold text-slate-900">{t.howItWorks}</h3>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white">
                  1
                </div>
                <h4 className="mb-2 font-semibold text-slate-900">{t.step1Title}</h4>
                <p className="text-sm text-slate-600">{t.step1Description}</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white">
                  2
                </div>
                <h4 className="mb-2 font-semibold text-slate-900">{t.step2Title}</h4>
                <p className="text-sm text-slate-600">{t.step2Description}</p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-xl font-bold text-white">
                  3
                </div>
                <h4 className="mb-2 font-semibold text-slate-900">{t.step3Title}</h4>
                <p className="text-sm text-slate-600">{t.step3Description}</p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="mb-4 text-slate-600">{t.tryAsking}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge
                variant="secondary"
                className="cursor-pointer rounded-full bg-teal-50 px-4 py-2 text-sm text-teal-700 hover:bg-teal-100"
                onClick={handleQuickStart}
              >
                {t.tag1}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer rounded-full bg-teal-50 px-4 py-2 text-sm text-teal-700 hover:bg-teal-100"
                onClick={handleQuickStart}
              >
                {t.tag2}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer rounded-full bg-teal-50 px-4 py-2 text-sm text-teal-700 hover:bg-teal-100"
                onClick={handleQuickStart}
              >
                {t.tag3}
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer rounded-full bg-teal-50 px-4 py-2 text-sm text-teal-700 hover:bg-teal-100"
                onClick={handleQuickStart}
              >
                {t.tag4}
              </Badge>
            </div>
          </div>
        </div>
      </section>

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
