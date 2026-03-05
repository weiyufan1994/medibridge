import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { LoginModal } from "@/features/auth/components/LoginModal";
import { useAuth } from "@/features/auth/hooks/useAuth";
import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/layout/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import DoctorDetail from "./pages/DoctorDetail";
import Hospitals from "./pages/Hospitals";
import AITriagePage from "./pages/AITriage";
import DashboardPage from "./pages/Dashboard";
import AdminPage from "./pages/Admin";
import AppointmentAccessPage from "./pages/AppointmentAccess";
import VisitRoomPage from "./pages/VisitRoom";
import PaymentSuccessPage from "./pages/PaymentSuccess";
import PaymentCancelPage from "./pages/PaymentCancel";
import ComponentShowcase from "./sandbox/ComponentShowcase";

function parseMagicLinkTokenFromUrl(): string | null {
  if (typeof window === "undefined") {
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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/triage"} component={AITriagePage} />
      <Route path={"/dashboard"} component={DashboardRouteGuard} />
      <Route path={"/admin"} component={AdminPage} />
      <Route path={"/appointment/:id"} component={AppointmentAccessPage} />
      <Route path={"/payment/success"} component={PaymentSuccessPage} />
      <Route path={"/payment/cancel"} component={PaymentCancelPage} />
      <Route path={"/visit/:id"} component={VisitRoomPage} />
      <Route path={"/doctor/:id"} component={DoctorDetail} />
      <Route path={"/hospitals"} component={Hospitals} />
      <Route path={"/__dev__/components"} component={ComponentShowcase} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function DashboardRouteGuard() {
  const { loading, isGuest, isLoginModalOpen, openLoginModal } = useAuth();

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
            请先登录以查看您的个人资料
          </h1>
          <p className="text-sm text-muted-foreground">
            登录后可查看账户状态、问诊记录与行程安排。
          </p>
          <Button onClick={openLoginModal}>登录/注册</Button>
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
