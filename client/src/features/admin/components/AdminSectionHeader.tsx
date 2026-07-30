import { Badge } from "@/components/ui/badge";

type AdminSectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  pills: string[];
};

export function AdminSectionHeader({
  eyebrow,
  title,
  description,
  pills,
}: AdminSectionHeaderProps) {
  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-white/95 p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          <Badge
            variant="outline"
            className="rounded-full border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700"
          >
            {eyebrow}
          </Badge>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>

        {pills.length > 0 ? (
          <div className="flex flex-wrap gap-2 xl:max-w-xl xl:justify-end">
            {pills.map(pill => (
              <Badge
                key={pill}
                variant="outline"
                className="rounded-full border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                {pill}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
