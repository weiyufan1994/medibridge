import type { LucideIcon } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type AdminNavigationItem = {
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AdminNavigationRailProps = {
  heading: string;
  description: string;
  items: AdminNavigationItem[];
  activeValue: string;
};

export function AdminNavigationRail({
  heading,
  description,
  items,
  activeValue,
}: AdminNavigationRailProps) {
  return (
    <aside className="min-h-0 self-stretch">
      <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-slate-200/80 bg-white/90 p-3 shadow-sm">
        <div className="shrink-0 px-3 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600">
            {heading}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        </div>

        <TabsList className="flex h-auto min-h-0 w-full flex-1 flex-col justify-start gap-1.5 overflow-y-auto rounded-[22px] bg-transparent p-0">
          {items.map(
            ({ value, label, description: itemDescription, icon: Icon }) => {
              const isActive = activeValue === value;

              return (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "h-auto w-full flex-none justify-start rounded-2xl border px-3 py-3 text-left shadow-none",
                    isActive
                      ? "border-teal-200 bg-teal-50 text-teal-950"
                      : "border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <span className="flex w-full items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border",
                        isActive
                          ? "border-teal-200 bg-white text-teal-700"
                          : "border-slate-200 bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {label}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block text-xs leading-5",
                          isActive ? "text-teal-700/80" : "text-slate-500"
                        )}
                      >
                        {itemDescription}
                      </span>
                    </span>
                  </span>
                </TabsTrigger>
              );
            }
          )}
        </TabsList>
      </div>
    </aside>
  );
}
