import { useEffect, useState, type ComponentType } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const ADMIN_SIDEBAR_STORAGE_KEY = "medibridge:admin-sidebar-collapsed";

export type AdminNavigationItem = {
  value: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type AdminNavigationRailProps = {
  items: AdminNavigationItem[];
  activeValue: string;
  collapseLabel: string;
  expandLabel: string;
};

export function AdminNavigationRail({
  items,
  activeValue,
  collapseLabel,
  expandLabel,
}: AdminNavigationRailProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    const persisted = window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
    if (persisted !== null) {
      return persisted === "true";
    }
    return window.innerWidth < 1280;
  });

  useEffect(() => {
    window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleLabel = isCollapsed ? expandLabel : collapseLabel;

  return (
    <aside
      className={cn(
        "hidden min-h-0 shrink-0 border-r border-admin-border bg-admin-sidebar transition-[width] duration-200 lg:flex lg:flex-col",
        isCollapsed ? "w-[68px]" : "w-[232px]"
      )}
    >
      <TabsList className="flex h-auto min-h-0 w-full flex-1 flex-col justify-start gap-1 overflow-y-auto rounded-none bg-transparent px-2 py-3">
        {items.map(({ value, label, icon: Icon }) => {
          const trigger = (
            <TabsTrigger
              key={value}
              value={value}
              aria-label={label}
              className={cn(
                "group h-10 w-full flex-none justify-start gap-3 rounded-lg border border-transparent px-3 text-sm font-medium shadow-none transition-colors",
                activeValue === value
                  ? "border-admin-border-strong bg-admin-accent text-admin-accent-foreground"
                  : "text-admin-muted-foreground hover:bg-admin-surface-muted hover:text-admin-foreground",
                isCollapsed && "justify-center px-0"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className={cn("truncate", isCollapsed && "sr-only")}>
                {label}
              </span>
            </TabsTrigger>
          );

          if (!isCollapsed) {
            return trigger;
          }

          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>{trigger}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </TabsList>

      <div className="border-t border-admin-border p-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size={isCollapsed ? "icon" : "sm"}
              className={cn(
                "text-admin-muted-foreground hover:bg-admin-surface-muted hover:text-admin-foreground",
                !isCollapsed && "w-full justify-start"
              )}
              aria-label={toggleLabel}
              onClick={() => setIsCollapsed(value => !value)}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
              {!isCollapsed ? <span>{collapseLabel}</span> : null}
            </Button>
          </TooltipTrigger>
          {isCollapsed ? (
            <TooltipContent side="right">{toggleLabel}</TooltipContent>
          ) : null}
        </Tooltip>
      </div>
    </aside>
  );
}
