import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import TopHeader from "@/components/layout/TopHeader";

export type DashboardNavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

type DashboardLayoutProps = {
  items: DashboardNavItem[];
  activeKey: string;
  onChange: (key: string) => void;
  topHeaderElements?: ReactNode;
  children: ReactNode;
};

export default function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <div className="w-full h-full overflow-hidden flex flex-col bg-slate-50 text-foreground">
      <TopHeader isDashboard rightElements={props.topHeaderElements} />
      <div className="flex-1 w-full h-full overflow-hidden flex gap-8 px-4 py-6 lg:px-6">
        <aside className="w-[260px] shrink-0 h-full overflow-y-auto">
          <nav className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-sm">
            {props.items.map(item => {
              const isActive = props.activeKey === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => props.onChange(item.key)}
                  className={[
                    "mb-1 flex w-full items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-left text-sm transition-colors",
                    isActive
                      ? "border-teal-600 bg-teal-50 font-medium text-teal-700"
                      : "border-transparent text-slate-600 hover:bg-slate-100/50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="flex-1 h-full overflow-y-auto">{props.children}</section>
      </div>
    </div>
  );
}
