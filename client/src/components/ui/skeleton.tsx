import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-slate-100 animate-pulse rounded-xl", className)}
      {...props}
    />
  );
}

export { Skeleton };
