'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Step, StepHeader } from './step-header';
import { EventDetailsStep } from './event-details-step';
import { TicketClassesStep } from './ticket-classes-step';
import { LayoutSetupStep } from './layout-setup-step';
import { ReviewStep } from './review-step';
import { TicketAssignmentStep } from './ticket-assignment-step';
import { toast } from 'sonner';
import { DraftHistoryModal, type DraftHistoryEntry } from './draft-history-modal';
import { deriveLayoutMode, deriveNextStep, generateLayout, autoMap, validateEvent, validateStep, LayoutDecision } from '@/src/lib/event-engine';
import { EventDetailsFormData, EventDraft, EventSeatingLayout, EventTicketClass, TicketMapping } from '@/src/types/event-draft';
import { getSectionCapacity } from '@/src/lib/event-engine';

const steps: Step[] = [
  { num: 1, name: '1. The Event' },
  { num: 2, name: '2. Tickets' },
  { num: 3, name: '3. Seating' },
  { num: 4, name: '4. Ticket Assignment' },
  { num: 5, name: '5. Review & Publish' },
];

type ValidationError = {
  step: number;
  message: string;
};

const initialDraftState: EventDraft = {
  details: {},
  ticketClasses: [],
  seatingLayout: {},
  ticketMappings: [],
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

  const layoutDecision = useMemo((): LayoutDecision => {
    if (!draft) return { mode: 'none', requiresLayout: false };
    return deriveLayoutMode(draft.ticketClasses);
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
            ticketClasses: loadedDraft.ticketClasses ?? initialDraftState.ticketClasses,
            seatingLayout: loadedDraft.seatingLayout ?? initialDraftState.seatingLayout,
            ticketMappings: loadedDraft.ticketMappings ?? initialDraftState.ticketMappings,
            meta: { ...initialDraftState.meta, ...(loadedDraft.meta ?? {}) },
          };
          setDraft(mergedDraft);
          setCurrentStep(deriveNextStep(mergedDraft));
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
    data: EventDetailsFormData | EventTicketClass[] | EventSeatingLayout | TicketMapping[],
    summary: string,
  ) => {
    if (!draft) return;
    const tempDraft: EventDraft = {
      ...draft,
      details: stepNumber === 1 ? data as EventDetailsFormData : draft.details,
      ticketClasses: stepNumber === 2 ? data as EventTicketClass[] : draft.ticketClasses,
      seatingLayout: stepNumber === 3 ? data as EventSeatingLayout : draft.seatingLayout,
      ticketMappings: stepNumber === 4 ? data as TicketMapping[] : draft.ticketMappings,
    };
    const issues = validateStep(tempDraft, stepNumber);
    
    if (issues.length > 0) {
        setValidationErrors(issues.map(issue => ({ step: stepNumber, message: `${issue.path.join('.')} - ${issue.message}` })));
        toast.error("Please fix the highlighted errors before continuing.");
        return;
    }
    setValidationErrors([]);

    const updatedDraft: EventDraft = { ...draft };

    switch (stepNumber) {
      case 1:
        updatedDraft.details = data as EventDetailsFormData;
        break;
      case 2:
        updatedDraft.ticketClasses = data as EventTicketClass[];
        const decision = deriveLayoutMode(updatedDraft.ticketClasses);
        if (decision.requiresLayout) {
            const generatedLayout = generateLayout(updatedDraft.ticketClasses);
            if (generatedLayout) {
                updatedDraft.seatingLayout = {
                  seatingConfig: generatedLayout,
                  seatState: generatedLayout.seatState,
                  summary: generatedLayout.summary,
                };
                updatedDraft.ticketMappings = autoMap(updatedDraft.ticketClasses, generatedLayout);
            }
        }
        break;
      case 3:
        {
          const seatingLayout = data as EventSeatingLayout;
          updatedDraft.seatingLayout = seatingLayout;
          updatedDraft.ticketMappings = autoMap(updatedDraft.ticketClasses, seatingLayout.seatingConfig, draft.ticketMappings);
        }
        break;
      case 4:
        updatedDraft.ticketMappings = data as TicketMapping[];
        break;
    }

    updatedDraft.meta.lastCompletedStep = Math.max(draft.meta.lastCompletedStep, stepNumber);
    
    const savedDraft = await persistDraft(updatedDraft, summary);
    if (savedDraft) {
      setDraft(savedDraft);
      setCurrentStep(deriveNextStep(savedDraft));
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    const issues = validateEvent(draft);
    if (issues.length > 0) {
        setValidationErrors(issues.map(issue => ({ step: 5, message: `${issue.path.join('.')} - ${issue.message}` })));
        toast.error("Please review and fix the errors on the final step before publishing.");
        setCurrentStep(5);
        return;
    }
    setValidationErrors([]);
    
    setIsSaving(true);
    const finalPayload = { details: draft.details, ticketClasses: draft.ticketClasses, layout: draft.seatingLayout };

    const res = await fetchWithSessionRetry('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
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
    if (currentStep === 5 && !layoutDecision.requiresLayout) {
      setCurrentStep(2);
    } else {
      setCurrentStep(s => Math.max(1, s - 1));
    }
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
      setCurrentStep(deriveNextStep(savedDraft));
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

  const savedSeatingLayout = draft.seatingLayout.seatingConfig ? draft.seatingLayout as EventSeatingLayout : undefined;

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
            <TicketClassesStep 
                initialData={draft.ticketClasses}
                onNext={(data) => handleStepCompletion(2, data, "Saved ticket classes")}
                onPrevious={handlePrevious}
            />
        )}

        {currentStep === 3 && layoutDecision.requiresLayout && (
            <LayoutSetupStep 
                initialData={savedSeatingLayout}
                layoutType={layoutDecision.mode === "none" ? "seating" : layoutDecision.mode}
                onNext={(data) => handleStepCompletion(3, data, "Saved seating layout")}
                onPrevious={handlePrevious}
                ticketClasses={draft.ticketClasses}
            />
        )}

        {currentStep === 4 && layoutDecision.requiresLayout && (
            <TicketAssignmentStep
                ticketClasses={draft.ticketClasses}
                sections={(draft.seatingLayout.seatingConfig?.sections ?? []).map((section) => ({
                    id: section.id,
                    name: section.name,
                    mapType: section.mapType,
                    capacity: getSectionCapacity(section),
                }))}
                assignmentData={draft.ticketMappings}
                onNext={(data) => handleStepCompletion(4, data, "Saved ticket assignments")}
                onPrevious={handlePrevious}
            />
        )}

        {currentStep === 5 && (
            <ReviewStep 
                formData={draft}
                onPublish={handlePublish}
                onPrevious={handlePrevious}
                canPublish={draft.meta.lastCompletedStep >= (layoutDecision.requiresLayout ? 4 : 2)}
                errors={validationErrors}
                goToStep={goToStep}
            />
        )}
      </div>
    </div>
  );
}
