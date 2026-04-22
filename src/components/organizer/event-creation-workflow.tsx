'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Step, StepHeader } from './step-header';
import { EventDetailsStep } from './event-details-step';
import { LayoutSetupStep, LayoutSetupData } from './layout-setup-step';
import { ReviewStep } from './review-step';
import { toast } from 'sonner';
import { DraftHistoryModal, type DraftHistoryEntry } from './draft-history-modal';
import { validateEvent, validateStep } from '@/src/lib/event-engine';
import { EventDetailsFormData, EventDraft } from '@/src/types/event-draft';

const steps: Step[] = [
  { num: 1, name: '1. Event Details' },
  { num: 2, name: '2. Seating & Pricing' },
  { num: 3, name: '3. Review & Submit' },
];

type ValidationError = {
  step: number;
  message: string;
};

const initialDraftState: EventDraft = {
  details: {},
  seatingLayout: {},
  meta: {
    lastCompletedStep: 0,
    version: 0,
    lastSaved: new Date().toISOString(),
    isPublished: false,
  },
};

async function fetchWithSessionRetry(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  if (response.status !== 401) {
    return response;
  }

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
  });

  if (!refreshResponse.ok) {
    return response;
  }

  return fetch(input, { ...init, credentials: "same-origin" });
}

export function EventCreationWorkflow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromEventId = searchParams.get('fromEventId');

  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [draftHistory, setDraftHistory] = useState<DraftHistoryEntry[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const completedSteps = useMemo(() => {
    const completed: Record<number, boolean> = {};
    if (!draft) return completed;
    for (let i = 1; i <= draft.meta.lastCompletedStep; i++) {
      completed[i] = true;
    }
    return completed;
  }, [draft]);

  useEffect(() => {
    const loadDraft = async () => {
      setLoading(true);
      const response = await fetchWithSessionRetry('/api/organizer/events/draft');
      if (response.ok) {
        const payload = await response.json();
        if (payload.data) {
          const loadedDraft = payload.data as Partial<EventDraft>;
          const mergedDraft: EventDraft = {
            ...initialDraftState,
            ...loadedDraft,
            details: { ...initialDraftState.details, ...(loadedDraft.details ?? {}) },
            seatingLayout: loadedDraft.seatingLayout ?? initialDraftState.seatingLayout,
            meta: { ...initialDraftState.meta, ...(loadedDraft.meta ?? {}) },
          };
          setDraft(mergedDraft);
          setCurrentStep(mergedDraft.meta.lastCompletedStep + 1);
        } else {
          setDraft(initialDraftState);
          setCurrentStep(1);
        }
      } else {
        setDraft(initialDraftState);
        setCurrentStep(1);
        toast.error("Failed to load draft.");
      }
      setLoading(false);
    };

    const loadHistory = async () => {
      const response = await fetchWithSessionRetry('/api/organizer/events/draft/history');
      if(response.ok) {
        const payload = await response.json();
        setDraftHistory(payload.data ?? []);
      }
    }

    loadDraft();
    loadHistory();
  }, [fromEventId]);

  const persistDraft = async (updatedDraft: EventDraft, changeSummary: string) => {
    setIsSaving(true);
    const payload = {
      ...updatedDraft,
      meta: { ...updatedDraft.meta, version: updatedDraft.meta.version + 1, lastSaved: new Date().toISOString() },
      changeSummary,
    };

    const res = await fetchWithSessionRetry('/api/organizer/events/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    if (!res.ok) {
      if (res.status === 401) {
        toast.error('Your session expired. Please sign in again.');
        router.push('/auth/login');
        return null;
      }
      const errorPayload = await res.json().catch(() => null);
      toast.error(errorPayload?.error?.message ?? 'Failed to save draft');
      return null;
    }
    
    toast.success(changeSummary);
    return payload;
  };

  const handleStepCompletion = async (
    stepNumber: number,
    data: EventDetailsFormData | LayoutSetupData,
    summary: string,
  ) => {
    if (!draft) return;
    const tempDraft: EventDraft = { ...draft };

    if (stepNumber === 1) {
      tempDraft.details = data as EventDetailsFormData;
    } else if (stepNumber === 2) {
      tempDraft.seatingLayout = data as LayoutSetupData;
    }

    const issues = validateStep(tempDraft, stepNumber);
    
    if (issues.length > 0) {
        setValidationErrors(issues.map(issue => ({ step: stepNumber, message: `${issue.path.join('.')} - ${issue.message}` })));
        toast.error("Please fix the highlighted errors before continuing.");
        return;
    }
    setValidationErrors([]);

    const updatedDraft: EventDraft = { ...tempDraft, meta: { ...tempDraft.meta, lastCompletedStep: Math.max(draft.meta.lastCompletedStep, stepNumber) } };
    
    const savedDraft = await persistDraft(updatedDraft, summary);
    if (savedDraft) {
      if (stepNumber === 2) {
        toast.success("Seating configuration saved");
      }
      setDraft(savedDraft);
      setCurrentStep(step => Math.min(steps.length, step + 1));
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    const savedDraft = await persistDraft(draft, "Saved draft for submission");
    if (!savedDraft) return;

    const issues = validateEvent(savedDraft);
    if (issues.length > 0) {
        setValidationErrors(issues.map(issue => ({ step: 3, message: `${issue.path.join('.')} - ${issue.message}` })));
        toast.error("Please review and fix the errors on the final step before publishing.");
        setDraft(savedDraft);
        setCurrentStep(3);
        return;
    }
    setValidationErrors([]);
    
    setIsSaving(true);

    const res = await fetchWithSessionRetry('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedDraft),
    });

    setIsSaving(false);
    if (res.ok) {
        toast.success('Event submitted for approval!');
        setDraft(initialDraftState);
        await fetchWithSessionRetry('/api/organizer/events/draft', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(null) 
        });
        router.push('/organizer/events');
    } else {
        const errorPayload = await res.json();
        toast.error("Failed to submit event:", { description: errorPayload?.error?.message ?? "An unknown error occurred." });
    }
  };

  const handlePrevious = () => {
    setCurrentStep(s => Math.max(1, s - 1));
  };

  const handleRestore = async (data: unknown) => {
    if (!data || typeof data !== 'object') {
        toast.error("Invalid draft data to restore.");
        return;
    }
    const restoredDraft = data as EventDraft;
    const summary = `Restored from version ${restoredDraft.meta.version}`;
    
    const savedDraft = await persistDraft(restoredDraft, summary);
    if (savedDraft) {
      setDraft(savedDraft);
      setCurrentStep(savedDraft.meta.lastCompletedStep + 1);
      toast.success(summary);
    }
    setIsHistoryModalOpen(false);
  }

  const goToStep = (step: number) => {
    if (completedSteps[step] || step === currentStep) {
      setCurrentStep(step);
    }
  }

  if (loading || !draft) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div>
       <DraftHistoryModal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        history={draftHistory}
        onRestore={handleRestore}
      />
      <StepHeader 
        steps={steps} 
        currentStep={currentStep} 
        completedSteps={completedSteps} 
        isSaving={isSaving}
        lastSaved={new Date(draft.meta.lastSaved)}
        onStepClick={goToStep}
        onViewHistory={() => setIsHistoryModalOpen(true)}
        errors={validationErrors.map(e => e.step)}
      />
      <div className="p-6">
        {currentStep === 1 && (
          <EventDetailsStep
            initialData={draft.details}
            onNext={(data) => handleStepCompletion(1, data, "Saved event details")}
          />
        )}

        {currentStep === 2 && (
            <LayoutSetupStep 
                initialData={draft.seatingLayout}
                layoutType={'mixed'}
                onNext={(data) => handleStepCompletion(2, data, "Saved seating layout")}
                onPrevious={handlePrevious}
                venueId={draft.venueId ?? undefined}
            />
        )}

        {currentStep === 3 && (
            <ReviewStep 
                formData={draft}
                onPublish={handlePublish}
                onPrevious={handlePrevious}
                canPublish={draft.meta.lastCompletedStep >= 2}
                errors={validationErrors}
                goToStep={goToStep}
            />
        )}
      </div>
    </div>
  );
}
