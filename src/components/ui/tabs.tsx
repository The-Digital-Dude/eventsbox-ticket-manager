"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/src/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex h-10 items-center rounded-xl bg-[rgb(var(--theme-accent-rgb)/0.08)] p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex items-center rounded-lg px-3 py-1.5 text-sm text-neutral-700 data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-[var(--theme-accent)] data-[state=active]:shadow",
        className,
      )}
      {...props}
    />
  );
}
