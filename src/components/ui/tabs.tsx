"use client";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/src/lib/utils";

export const Tabs = TabsPrimitive.Root;
export const TabsContent = TabsPrimitive.Content;

export function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List className={cn("inline-flex h-10 items-center rounded-xl bg-neutral-100 p-1", className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger className={cn("inline-flex items-center rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-white data-[state=active]:shadow", className)} {...props} />;
}
