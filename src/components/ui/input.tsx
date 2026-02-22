import { cn } from "@/src/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition focus-visible:border-[rgb(var(--theme-accent-rgb)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.2)]",
        className,
      )}
      {...props}
    />
  );
}
