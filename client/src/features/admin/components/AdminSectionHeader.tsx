import type { ReactNode } from "react";

type AdminSectionHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AdminSectionHeader({
  title,
  description,
  actions,
}: AdminSectionHeaderProps) {
  return (
    <header className="flex min-h-[72px] shrink-0 flex-col justify-center gap-3 border-b border-admin-border bg-admin-surface px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-[-0.02em] text-admin-foreground">
          {title}
        </h1>
        <p className="mt-1 truncate text-sm text-admin-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
