import { cn } from "@/src/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--border)] bg-[rgb(var(--theme-accent-rgb)/0.06)] px-2.5 py-0.5 text-xs font-medium text-[var(--theme-accent)]",
        className,
      )}
      {...props}
    />
  );
}
