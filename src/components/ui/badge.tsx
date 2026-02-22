import { cn } from "@/src/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex items-center rounded-full border border-neutral-300 bg-neutral-50 px-2.5 py-0.5 text-xs font-medium", className)} {...props} />;
}
