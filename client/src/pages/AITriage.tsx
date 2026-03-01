import AITriageChat from "@/components/AITriageChat";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Hospital, Stethoscope } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AITriagePage() {
  const { resolved } = useLanguage();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50">
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
              <Stethoscope className="h-5 w-5 text-sky-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">MediBridge</h1>
              <p className="text-xs text-slate-500">
                {resolved === "zh"
                  ? "阶段一：AI 预诊与医生推荐"
                  : "Phase 1: AI Triage & Doctor Recommendation"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {resolved === "zh" ? "返回首页" : "Back Home"}
              </Button>
            </Link>
            <Link href="/hospitals">
              <Button variant="outline" size="sm">
                <Hospital className="mr-2 h-4 w-4" />
                {resolved === "zh" ? "医院列表" : "Hospitals"}
              </Button>
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {resolved === "zh" ? "AI Medical Consultation" : "AI Medical Consultation"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Describe your symptoms and we'll recommend the best doctors for you
          </p>
        </div>
        <AITriageChat />
      </div>
    </main>
  );
}
