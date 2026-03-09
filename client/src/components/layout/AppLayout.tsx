import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Shield,
  Stethoscope,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { getHomeCopy } from "@/features/home/copy";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AppLayoutProps = {
  title: string;
  showBack?: boolean;
  rightElements?: ReactNode;
  children: ReactNode;
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

export default function AppLayout({
  title,
  showBack: _showBack = true,
  rightElements,
  children,
}: AppLayoutProps) {
  const [, setLocation] = useLocation();
  const { resolved } = useLanguage();
  const homeCopy = getHomeCopy(resolved);
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
              role?: string | null;
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
              role?: string | null;
              avatarUrl?: string | null;
              imageUrl?: string | null;
            }
          | null
          | undefined);

  const user = resolvedUser && resolvedUser.isGuest !== 1 ? resolvedUser : null;

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
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
    <div className="min-h-screen w-full flex flex-col bg-white text-foreground">
      <header className="sticky top-0 z-50 w-full px-6 h-16 flex items-center justify-between border-b border-slate-200 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={() => setLocation("/")}
            className="inline-flex appearance-none items-center gap-2.5 rounded-xl border-0 bg-transparent p-0 m-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
            aria-label="Go to homepage"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 shadow-sm">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 flex flex-col items-start">
              <span className="block text-2xl font-bold leading-none text-gray-900">
                MediBridge
              </span>
              <span className="mt-0.5 block text-sm leading-tight text-gray-500">
                {homeCopy.brandSubtitle}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {rightElements}
            <button
              type="button"
              title={homeCopy.browseHospitals}
              aria-label={homeCopy.browseHospitals}
              className="rounded-full p-2 text-slate-500 transition-colors hover:bg-teal-50 hover:text-teal-600"
              onClick={() => setLocation("/hospitals")}
            >
              <Building2 className="h-5 w-5" />
            </button>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-xl p-1.5 transition hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
                    aria-label="Open account menu"
                  >
                    <Avatar className="h-9 w-9 border border-gray-200">
                      <AvatarImage src={user.avatarUrl || user.imageUrl || undefined} />
                      <AvatarFallback className="bg-teal-50 text-xs font-semibold text-teal-700">
                        {getInitials(user.name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 rounded-xl border-gray-100 p-1.5 shadow-md">
                  <DropdownMenuItem
                    className="rounded-lg"
                    onClick={() => setLocation("/dashboard")}
                  >
                    <LayoutDashboard className="h-4 w-4 text-gray-500" />
                    {homeCopy.dashboard}
                  </DropdownMenuItem>
                  {user.role === "pro" || user.role === "admin" ? (
                    <DropdownMenuItem
                      className="rounded-lg"
                      onClick={() => setLocation("/admin")}
                    >
                      <Shield className="h-4 w-4 text-gray-500" />
                      {homeCopy.admin}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="rounded-lg"
                    variant="destructive"
                    onClick={() => void handleLogout()}
                  >
                    <LogOut className="h-4 w-4" />
                    {homeCopy.logout}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}

            <LanguageSwitcher />
          </div>
      </header>

      <main className="flex-1 min-h-0 w-full overflow-y-auto flex" aria-label={title}>
        {children}
      </main>
    </div>
  );
}
