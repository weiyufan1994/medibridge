import type { ReactNode } from "react";

export function FieldShell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function SectionBox({
  title,
  children,
  collapsible = false,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="rounded-xl border border-admin-border bg-admin-surface">
        <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-admin-foreground">
          {title}
        </summary>
        <div className="border-t border-admin-border px-3 py-3">{children}</div>
      </details>
    );
  }

  return (
    <section className="rounded-xl border border-admin-border bg-admin-surface px-3 py-3">
      <div className="mb-2 text-sm font-semibold text-admin-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

export function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-admin-border bg-admin-surface-muted px-2 py-1">
      <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className="truncate text-xs font-medium text-foreground">
        {value}
      </div>
    </div>
  );
}
