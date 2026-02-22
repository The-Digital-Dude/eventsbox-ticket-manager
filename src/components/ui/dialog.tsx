"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/src/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/20" />
      <DialogPrimitive.Content className={cn("fixed left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-lg", className)} {...props} />
    </DialogPrimitive.Portal>
  );
}
