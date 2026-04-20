'use client';

import { cn } from "@/src/lib/utils";

export type Step = {
  num: number;
  name: string;
};

export function StepHeader({
  steps,
  currentStep,
  completedSteps,
  isSaving,
  lastSaved,
  onStepClick,
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: Record<number, boolean>;
  isSaving: boolean;
  lastSaved: Date | null;
  onStepClick: (stepNum: number) => void;
}) {
  return (
    <div className="border-b border-neutral-200 bg-white shadow-sm sticky top-0 z-10">
      <div className="flex justify-between items-center px-6">
        <nav className="-mb-px flex" aria-label="Progress">
          {steps.map((step) => {
            const isCompleted = completedSteps[step.num];
            const isCurrent = step.num === currentStep;

            return (
              <button
                key={step.name}
                className="py-4 px-6 flex items-center disabled:cursor-not-allowed"
                onClick={() => onStepClick(step.num)}
                disabled={!isCompleted && !isCurrent}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                    isCompleted ? "bg-emerald-500 text-white" : isCurrent ? "bg-sky-500 text-white" : "bg-neutral-200 text-neutral-500",
                  )}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>
                <span className={cn("ml-3 text-sm font-medium", isCurrent ? "text-sky-600" : "text-neutral-500")}>
                  {step.name}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="text-sm text-neutral-500">
          {isSaving ? "Saving..." : lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : ""}
        </div>
      </div>
    </div>
  );
}
