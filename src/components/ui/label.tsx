import { cn } from "@/src/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-neutral-800", className)} {...props} />;
}
