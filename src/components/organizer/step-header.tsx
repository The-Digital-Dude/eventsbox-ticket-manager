'use client';

import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";

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
  onViewHistory,
  errors = [],
}: {
  steps: Step[];
  currentStep: number;
  completedSteps: Record<number, boolean>;
  isSaving: boolean;
  lastSaved: Date | null;
  onStepClick: (stepNum: number) => void;
  onViewHistory: () => void;
  errors?: number[];
}) {
  return (
    <div className="border-b border-neutral-200 bg-white shadow-sm sticky top-0 z-10">
      <div className="flex justify-between items-center px-6">
        <nav className="-mb-px flex" aria-label="Progress">
          {steps.map((step) => {
            const isCompleted = completedSteps[step.num];
            const isCurrent = step.num === currentStep;
            const hasError = errors.includes(step.num);
            const isDisabled = !isCompleted && !isCurrent && !hasError;

            return (
              <button
                key={step.name}
                className={cn(
                  "py-4 px-6 flex items-center transition-colors duration-200",
                  isDisabled ? "cursor-not-allowed opacity-50" : "hover:bg-neutral-50",
                   hasError && "border-b-2 border-red-500"
                )}
                onClick={() => onStepClick(step.num)}
                disabled={isDisabled}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                    hasError ? "bg-red-500 text-white" : isCompleted ? "bg-emerald-500 text-white" : isCurrent ? "bg-sky-500 text-white" : "bg-neutral-200 text-neutral-500",
                  )}
                >
                  {isCompleted && !hasError ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.num
                  )}
                </div>
                <span className={cn(
                    "ml-3 text-sm font-medium", 
                    hasError ? "text-red-600" : isCurrent ? "text-sky-600" : isCompleted ? "text-neutral-900" : "text-neutral-500"
                  )}>
                  {step.name}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 text-sm text-neutral-500">
          <Button variant="outline" size="sm" onClick={onViewHistory}>View History</Button>
          {isSaving ? "Saving..." : lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : ""}
        </div>
      </div>
    </div>
  );
}
