'use client';

import * as DialogPrimitive from "@radix-ui/react-dialog";

import { Dialog, DialogContent } from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";

export type DraftHistoryEntry = {
  version: number;
  savedAt: string;
  stepName: string;
  changeSummary: string | null;
  formData: unknown;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: DraftHistoryEntry[];
  onRestore: (formData: unknown) => void;
};

export function DraftHistoryModal({ open, onOpenChange, history, onRestore }: Props) {
  const historyEntries = Array.isArray(history) ? history : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <div className="mb-4">
          <DialogPrimitive.Title className="text-lg font-semibold text-neutral-900">Draft History</DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-neutral-500">
            Here you can see the history of your draft and restore to a previous version.
          </DialogPrimitive.Description>
        </div>
        <div className="space-y-4">
          {historyEntries.length === 0 ? (
            <p className="text-sm text-neutral-500">No history available.</p>
          ) : (
            <div className="space-y-4">
              {historyEntries.map(entry => (
                <div key={entry.version} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Version {entry.version}</p>
                      <p className="text-sm text-neutral-500">Saved at {new Date(entry.savedAt).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onRestore(entry.formData)}>
                      Restore
                    </Button>
                  </div>
                  <div className="mt-2">
                    <p className="text-sm">Step: {entry.stepName}</p>
                    {entry.changeSummary && <p className="text-sm">Changes: {entry.changeSummary}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
