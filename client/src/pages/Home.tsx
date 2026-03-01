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

const DISCLAIMER_KEY = "medibridge_disclaimer_accepted_v1";

export default function Home() {
  const [, setLocation] = useLocation();
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
                <p className="text-sm text-muted-foreground">AI-Powered Medical Bridge to China</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/hospitals">
                <Button variant="ghost" size="sm">
                  <Hospital className="mr-2 h-4 w-4" />
                  Browse Hospitals
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
            <h2 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">
              Connect with Top Chinese Medical Experts
            </h2>
            <p className="mx-auto mb-8 max-w-3xl text-xl text-muted-foreground">
              MediBridge uses AI to match you with the best doctors and specialists from
              Shanghai&apos;s premier hospitals. Get expert medical opinions and treatment options in
              China.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button size="lg" className="px-8 text-lg" onClick={handleStartConsultation}>
                Start Consultation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Link href="/hospitals">
                <Button size="lg" variant="outline" className="px-8 text-lg">
                  Browse Hospitals
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
                <CardTitle>AI-Powered Matching</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our intelligent system analyzes your symptoms and medical needs to recommend the
                  most suitable specialists.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Hospital className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Top Hospitals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access over 1,100 doctors from 6 prestigious Grade-A tertiary hospitals in
                  Shanghai.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Stethoscope className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Expert Specialists</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Connect with highly-rated specialists across cardiology, oncology, orthopedics,
                  and more.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border bg-card p-8">
            <h3 className="mb-8 text-center text-2xl font-bold">How It Works</h3>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  1
                </div>
                <h4 className="mb-2 font-semibold">Describe Your Condition</h4>
                <p className="text-sm text-muted-foreground">
                  Chat with our AI assistant about your symptoms and medical history
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  2
                </div>
                <h4 className="mb-2 font-semibold">Get Recommendations</h4>
                <p className="text-sm text-muted-foreground">
                  Receive personalized doctor recommendations based on your needs
                </p>
              </div>
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  3
                </div>
                <h4 className="mb-2 font-semibold">Connect with Doctors</h4>
                <p className="text-sm text-muted-foreground">
                  View detailed profiles and connect with your chosen specialists
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="mb-4 text-muted-foreground">Try asking about:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                Heart Problems
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                Cancer Screening
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                Joint Pain
              </Badge>
              <Badge
                variant="secondary"
                className="cursor-pointer px-4 py-2 text-sm hover:bg-secondary/80"
                onClick={handleQuickStart}
              >
                Neurological Issues
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={disclaimerOpen} onOpenChange={setDisclaimerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Medical Disclaimer</DialogTitle>
            <DialogDescription>
              AI recommendations are only for triage and doctor matching. They are not a diagnosis
              and do not replace professional medical care.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Do not share highly sensitive identity details (ID/passport numbers) in chat.</p>
            <p>
              If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or
              other emergencies, call local emergency services immediately.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisclaimerOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAcceptDisclaimer}>I Understand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
