import { ReactNode } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Hospital, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type AppLayoutProps = {
  title: string;
  showBack?: boolean;
  rightElements?: ReactNode;
  children: ReactNode;
};

export default function AppLayout({
  title,
  showBack = true,
  rightElements,
  children,
}: AppLayoutProps) {
  const [, setLocation] = useLocation();
  const { mode, setMode } = useLanguage();
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const rawData = meQuery.data as unknown;
  const resolvedUser =
    rawData && typeof rawData === "object" && "user" in rawData
      ? (
          rawData as {
            user?: {
              isGuest?: number;
              name?: string | null;
              email?: string | null;
              avatarUrl?: string | null;
              imageUrl?: string | null;
            } | null;
          }
        ).user
      : (rawData as
          | {
              isGuest?: number;
              name?: string | null;
              email?: string | null;
              avatarUrl?: string | null;
              imageUrl?: string | null;
            }
          | null
          | undefined);

  const user = resolvedUser && resolvedUser.isGuest !== 1 ? resolvedUser : null;

  const handleBack = () => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    setLocation("/");
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      setLocation("/");
      toast.success("已退出登录");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Logout failed, please retry."
      );
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="mx-auto flex h-[84px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {showBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleBack}
                aria-label="Go back"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
              <Stethoscope className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl leading-none font-bold text-foreground">
                MediBridge
              </p>
              <p className="text-sm text-muted-foreground">
                AI-Powered Medical Bridge to China
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocation("/dashboard")}
                >
                  个人中心
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleLogout()}
                >
                  退出登录
                </Button>
              </>
            ) : null}

            {rightElements}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/hospitals")}
            >
              <Hospital className="mr-2 h-4 w-4" />
              Browse Hospitals
            </Button>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
