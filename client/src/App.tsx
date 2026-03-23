import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AnalyticsLoader } from "@/components/AnalyticsLoader";
import { LoginModal } from "@/features/auth/components/LoginModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { Suspense, lazy, useEffect } from "react";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext";
import { getDashboardCopy } from "@/features/dashboard/copy";

const HomePage = lazy(() => import("./pages/Home"));
const DoctorDetailPage = lazy(() => import("./pages/DoctorDetail"));
const DoctorClaimInvitePage = lazy(() => import("./pages/DoctorClaimInvite"));
const DoctorWorkbenchPage = lazy(() => import("./pages/DoctorWorkbench"));
const HospitalsPage = lazy(() => import("./pages/Hospitals"));
const AITriagePage = lazy(() => import("./pages/AITriage"));
const DashboardPage = lazy(() => import("./pages/Dashboard"));
const AdminPage = lazy(() => import("./pages/Admin"));
const AppointmentAccessPage = lazy(() => import("./pages/AppointmentAccess"));
const VisitRoomPage = lazy(() => import("./pages/VisitRoom"));
const PaymentSuccessPage = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancelPage = lazy(() => import("./pages/PaymentCancel"));
const MockCheckoutPage = lazy(() => import("./pages/MockCheckout"));
const DevComponentShowcasePage = import.meta.env.DEV
  ? lazy(() => import("./sandbox/ComponentShowcase"))
  : null;

function parseMagicLinkTokenFromUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!/^\/appointment\/\d+$/.test(window.location.pathname)) {
    return null;
  }

  const token = new URLSearchParams(window.location.search).get("token");
  const normalized = token?.trim();
  return normalized && normalized.length > 0 ? normalized : null;
}

function parseAppointmentIdFromPathname(pathname: string): number | undefined {
  const match = /^\/appointment\/(\d+)$/.exec(pathname);
  if (!match) {
    return undefined;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function AuthBootstrap() {
  const utils = trpc.useUtils();
  const verifyMagicLinkMutation = trpc.auth.verifyMagicLink.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const token = parseMagicLinkTokenFromUrl();
    if (!token) {
      return;
    }

    const appointmentId = parseAppointmentIdFromPathname(window.location.pathname);
    void verifyMagicLinkMutation
      .mutateAsync({ token, appointmentId })
      .finally(() => {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("token");
        window.history.replaceState(
          {},
          document.title,
          `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
        );
      });
  }, [verifyMagicLinkMutation]);

  return null;
}

function RouteFallback() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </main>
  );
}

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path={"/"} component={HomePage} />
        <Route path={"/triage"} component={AITriagePage} />
        <Route path={"/dashboard"} component={DashboardRouteGuard} />
        <Route path={"/admin"} component={AdminPage} />
        <Route path={"/appointment/:id"} component={AppointmentAccessPage} />
        <Route path={"/payment/success"} component={PaymentSuccessPage} />
        <Route path={"/payment/cancel"} component={PaymentCancelPage} />
        <Route path={"/mock-checkout/:bookingId"} component={MockCheckoutPage} />
        <Route path={"/visit/:id"} component={VisitRoomPage} />
        <Route path={"/doctor/claim"} component={DoctorClaimInvitePage} />
        <Route path={"/doctor/workbench"} component={DoctorWorkbenchPage} />
        <Route path={"/doctor/:id/workbench"} component={DoctorWorkbenchPage} />
        <Route path={"/doctor/:id"} component={DoctorDetailPage} />
        <Route path={"/hospitals"} component={HospitalsPage} />
        {DevComponentShowcasePage ? (
          <Route path={"/__dev__/components"} component={DevComponentShowcasePage} />
        ) : null}
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function DashboardRouteGuard() {
  const { loading, isGuest, isLoginModalOpen, openLoginModal } = useAuth();
  const { resolved } = useLanguage();
  const t = getDashboardCopy(resolved);

  useEffect(() => {
    if (!loading && isGuest && !isLoginModalOpen) {
      openLoginModal();
    }
  }, [isGuest, isLoginModalOpen, loading, openLoginModal]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (isGuest) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <div className="space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            {t.guardTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t.guardDesc}
          </p>
          <Button onClick={openLoginModal}>{t.guardAction}</Button>
        </div>
      </main>
    );
  }

  return <DashboardPage />;
}

function GlobalLoginModal() {
  const { isLoginModalOpen, openLoginModal, closeLoginModal } = useAuth();

  return (
    <LoginModal
      open={isLoginModalOpen}
      onOpenChange={nextOpen => {
        if (nextOpen) {
          openLoginModal();
          return;
        }
        closeLoginModal();
      }}
    />
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <LanguageProvider>
          <TooltipProvider>
            <AuthBootstrap />
            <AnalyticsLoader />
            <Toaster />
            <Router />
            <GlobalLoginModal />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
