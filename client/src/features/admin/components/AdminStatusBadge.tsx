import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AdminStatusTone =
  | "neutral"
  | "info"
  | "warning"
  | "success"
  | "danger";

const TONE_STYLES: Record<AdminStatusTone, string> = {
  neutral:
    "border-admin-border bg-admin-surface-muted text-admin-muted-foreground",
  info: "border-sky-300/70 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  warning:
    "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  success:
    "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  danger:
    "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
};

const ICONS = {
  neutral: Circle,
  info: Clock3,
  warning: AlertTriangle,
  success: CheckCircle2,
  danger: XCircle,
} satisfies Record<AdminStatusTone, typeof Circle>;

export function AdminStatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: AdminStatusTone;
  className?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        TONE_STYLES[tone],
        className
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {label}
    </span>
  );
}
