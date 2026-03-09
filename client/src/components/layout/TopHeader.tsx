import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Building2, LayoutDashboard, LogOut, Shield, Stethoscope } from "lucide-react";
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

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/");
      toast.success(resolved === "zh" ? "已退出登录" : "Signed out");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : resolved === "zh"
            ? "退出失败，请重试。"
            : "Logout failed, please retry."
      );
    }
  };

  return (
    <header className="w-full px-6 h-16 flex items-center justify-between border-b border-slate-200 bg-white flex-shrink-0">
    <Link
      href="/"
      aria-label="MediBridge home"
      className="flex items-center gap-3"
    >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-start">
            <span className="block text-xl font-bold leading-none text-slate-900">
              MediBridge
            </span>
            <span className="mt-0.5 block text-xs leading-tight font-normal text-slate-500">
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
              className="h-10 w-10 inline-flex items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
              onClick={() => setLocation("/hospitals")}
            >
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}

          {!isAuthenticated ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-600/30 focus-visible:ring-offset-0"
              onClick={openLoginModal}
            >
              {t.login}
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full p-1.5 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
                  aria-label="Open account menu"
                >
                  <Avatar className="h-9 w-9 border border-slate-200">
                    <AvatarImage />
                    <AvatarFallback className="bg-teal-50 text-xs font-semibold text-teal-700">
                      {getInitials(user?.name, user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl border-slate-100 p-1.5 shadow-md">
                <DropdownMenuItem className="rounded-lg" onClick={() => setLocation("/dashboard")}>
                  <LayoutDashboard className="h-4 w-4 text-slate-500" />
                  {t.dashboard}
                </DropdownMenuItem>
                {user?.role === "pro" || user?.role === "admin" ? (
                  <DropdownMenuItem className="rounded-lg" onClick={() => setLocation("/admin")}>
                    <Shield className="h-4 w-4 text-slate-500" />
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
    </header>
  );
}
