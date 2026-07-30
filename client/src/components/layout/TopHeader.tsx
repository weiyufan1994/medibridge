import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Shield,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHomeCopy } from "@/features/home/copy";
import { toast } from "sonner";

type TopHeaderProps = {
  children?: ReactNode;
  rightElements?: ReactNode;
  subtitle?: string;
  isDashboard?: boolean;
  isVisitRoom?: boolean;
};

function getInitials(name?: string | null, email?: string | null) {
  const source = (name || email || "U").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function TopHeader(props: TopHeaderProps) {
  const [, setLocation] = useLocation();
  const { resolved } = useLanguage();
  const t = getHomeCopy(resolved);
  const { user, isAuthenticated, openLoginModal, logout } = useAuth();
  const shouldShowBrowseHospitals = !props.isDashboard && !props.isVisitRoom;
  const subtitleText = props.subtitle ?? t.brandSubtitle;
  const role = String(user?.role ?? "");

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/");
      toast.success(t.logoutSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.logoutFailed);
    }
  };

  return (
    <header className="h-16 w-full flex-shrink-0 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      <div className="mx-auto flex h-full w-full max-w-[1680px] items-center justify-between">
        <Link
          href="/"
          aria-label={t.brandHomeLabel}
          className="flex items-center gap-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-start">
            <span className="block text-xl font-bold leading-none text-foreground">
              MediBridge
            </span>
            <span className="mt-0.5 block text-xs leading-tight font-normal text-muted-foreground">
              {subtitleText}
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          {props.children}
          {props.rightElements}
          {shouldShowBrowseHospitals ? (
            <button
              type="button"
              title={t.browseHospitals}
              aria-label={t.browseHospitals}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              onClick={() => setLocation("/triage")}
            >
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          {!isAuthenticated ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-border text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-0"
              onClick={openLoginModal}
            >
              {t.login}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full p-1.5 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  aria-label={t.accountMenuLabel}
                >
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage />
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {getInitials(user?.name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border-border p-1.5 shadow-md"
              >
                <DropdownMenuItem
                  className="rounded-lg"
                  onClick={() => setLocation("/dashboard")}
                >
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  {t.dashboard}
                </DropdownMenuItem>
                {role === "admin" || role === "ops" ? (
                  <DropdownMenuItem
                    className="rounded-lg"
                    onClick={() => setLocation("/admin")}
                  >
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    {t.admin}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="rounded-lg"
                  variant="destructive"
                  onClick={() => void handleLogout()}
                >
                  <LogOut className="h-4 w-4" />
                  {t.logout}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
