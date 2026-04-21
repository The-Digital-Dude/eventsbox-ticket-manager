'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Step, StepHeader } from './step-header';
import { EventDetailsStep } from './event-details-step';
import { TicketClassesStep, type TicketClass } from './ticket-classes-step';
import { LayoutSetupStep, type LayoutSetupData } from './layout-setup-step';
import { ReviewStep } from './review-step';
import { TicketAssignmentStep } from './ticket-assignment-step';
import { toast } from 'sonner';
import { DraftHistoryModal, type DraftHistoryEntry } from './draft-history-modal';
import { deriveLayoutFromTicketClasses, type LayoutDecision } from '@/src/lib/layout-detector';
import { sharedEventSchema } from '@/src/lib/validators/shared-event-schema';
import type { EventDetailsFormData } from '@/src/types/event-form-data';
import {
  generateInitialLayoutFromTicketClasses,
  generateLayoutAssignments,
  getSectionCapacity,
  type LayoutAssignmentData,
} from '@/src/lib/layout-auto-generator';

const steps: Step[] = [
  { num: 1, name: '1. The Event' },
  { num: 2, name: '2. Tickets' },
  { num: 3, name: '3. Seating' },
  { num: 4, name: '4. Ticket Assignment' },
  { num: 5, name: '5. Review & Publish' },
];

type EventFormData = {
    step1?: EventDetailsFormData;
    step2?: TicketClass[];
    step3?: LayoutSetupData;
    step4?: LayoutAssignmentData;
    lastCompletedStep?: number;
}

type ExistingEventTicketClass = {
  id: string;
  name: string;
  price: number | string;
  quantity: number;
  classType: TicketClass["classType"];
};

type ExistingEventData = EventDetailsFormData & {
  category?: { id: string } | null;
  venue?: { id: string } | null;
  commissionPct: number | string;
  gstPct: number | string;
  platformFeeFixed: number | string;
  ticketClasses: ExistingEventTicketClass[];
};

type DraftStepData = EventDetailsFormData | TicketClass[] | LayoutSetupData | LayoutAssignmentData;

type PublishPayload = EventDetailsFormData & {
  ticketClasses: Array<TicketClass & { eventSeatingSectionId: string | null }>;
  layout?: LayoutSetupData;
};

type ValidationError = {
    step: number;
    message: string;
}

function normalizeDraftHistory(payload: unknown): DraftHistoryEntry[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const nestedData = (payload as { data: unknown }).data;
    return Array.isArray(nestedData) ? nestedData : [];
  }
  return [];
}

function buildPublishPayload(formData: EventFormData | null): PublishPayload | null {
  if (!formData?.step1 || !formData.step2) {
    return null;
  }

  return {
    ...formData.step1,
    ticketClasses: formData.step2.map((ticketClass) => ({
      ...ticketClass,
      eventSeatingSectionId: formData.step4?.assignments?.[ticketClass.id] ?? null,
    })),
    layout: formData.step3,
  };
}

export function EventCreationWorkflow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromEventId = searchParams.get('fromEventId');

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [formData, setFormData] = useState<EventFormData | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [layoutDecision, setLayoutDecision] = useState<LayoutDecision>({ layoutType: 'none', requiresLayout: false });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [draftHistory, setDraftHistory] = useState<DraftHistoryEntry[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      let initialFormData: EventFormData | null = null;

      if (fromEventId) {
        // Load existing event data
        const [eventRes, layoutRes, historyRes] = await Promise.all([
          fetch(`/api/organizer/events/${fromEventId}`),
          fetch(`/api/organizer/events/${fromEventId}/layout`),
          fetch('/api/organizer/events/draft/history'),
        ]);

        const eventPayload = await eventRes.json();
        const layoutPayload = await layoutRes.json();
        const historyPayload = await historyRes.json();

        if (historyRes.ok && historyPayload.data) {
          setDraftHistory(normalizeDraftHistory(historyPayload.data));
        }

        if (eventRes.ok && eventPayload.data) {
          const eventData = eventPayload.data as ExistingEventData;
          const layoutData = layoutRes.ok ? layoutPayload.data : null;

          // Transform existing event data to EventFormData structure
          const transformedFormData: EventFormData = {
            step1: {
              title: eventData.title,
              description: eventData.description,
              categoryId: eventData.category?.id ?? "",
              venueId: eventData.venue?.id ?? "",
              countryId: eventData.countryId, // Assuming eventData has countryId
              stateId: eventData.stateId,   // Assuming eventData has stateId
              cityName: eventData.cityName, // Assuming eventData has cityName
              startAt: eventData.startAt,
              endAt: eventData.endAt,
              timezone: eventData.timezone,
              contactEmail: eventData.contactEmail,
              contactPhone: eventData.contactPhone,
              heroImage: eventData.heroImage,
              videoUrl: eventData.videoUrl,
              cancelPolicy: eventData.cancelPolicy,
              refundPolicy: eventData.refundPolicy,
              currency: eventData.currency,
              commissionPct: eventData.commissionPct.toString(),
              gstPct: eventData.gstPct.toString(),
              platformFeeFixed: eventData.platformFeeFixed.toString(),
              tags: eventData.tags,
              audience: eventData.audience,
              lat: eventData.lat,
              lng: eventData.lng,
              stateName: eventData.stateName, // Assuming eventData has stateName
              cityId: eventData.cityId,     // Assuming eventData has cityId
            },
            step2: eventData.ticketClasses.map((tc) => ({
              id: tc.id,
              name: tc.name,
              price: Number(tc.price),
              quantity: tc.quantity,
              classType: tc.classType,
            })),
            step3: layoutData ? { 
                seatingConfig: layoutData.seating.seatingConfig,
                seatState: layoutData.seating.seatState,
                summary: layoutData.seating.seatingConfig.summary
            } : undefined,
            lastCompletedStep: layoutData ? 3 : 2, // If layout exists, step 3 is completed, else step 2
          };
          initialFormData = transformedFormData;
          toast.success("Loaded existing event for advanced setup.");
        } else {
          toast.error("Failed to load existing event data.");
        }
      } else {
        // Load existing draft data
        const [draftRes, historyRes] = await Promise.all([
          fetch('/api/organizer/events/draft'),
          fetch('/api/organizer/events/draft/history'),
        ]);
        const draftPayload = await draftRes.json();
        const historyPayload = await historyRes.json();

        if (draftRes.ok && draftPayload.data) {
          initialFormData = draftPayload.data;
        }

        if (historyRes.ok && historyPayload.data) {
          setDraftHistory(normalizeDraftHistory(historyPayload.data));
        }
      }

      if (initialFormData) {
        setFormData(initialFormData);
        const decision = deriveLayoutFromTicketClasses(initialFormData.step2 ?? []);
        setLayoutDecision(decision);
        
        const lastCompleted = initialFormData.lastCompletedStep ?? 0;
        const newCompletedSteps: Record<number, boolean> = {};
        for (let i = 1; i <= lastCompleted; i++) {
            newCompletedSteps[i] = true;
        }
        setCompletedSteps(newCompletedSteps);

        let nextStepToResume = lastCompleted + 1;

        // Special handling for conditional steps on resume
        if (nextStepToResume === 3 && !decision.requiresLayout) {
            nextStepToResume = 5; // Skip layout if not required
        } else if (nextStepToResume === 4 && !decision.requiresLayout) {
            nextStepToResume = 5; // Also skip assignment if layout was skipped
        }

        setCurrentStep(nextStepToResume > steps.length ? steps.length : nextStepToResume);
      }
      setLoadingDraft(false);
    }
    loadData();
  }, [fromEventId]); // Re-run if fromEventId changes

  const saveDraft = async (data: DraftStepData, stepNum: number, changeSummary?: string) => {
    const newFormData = { ...formData, [`step${stepNum}`]: data, lastCompletedStep: Math.max(formData?.lastCompletedStep ?? 0, stepNum) };
    const saved = await persistDraft(newFormData, changeSummary);
    return saved ? newFormData : null;
  };

  const persistDraft = async (nextFormData: EventFormData, changeSummary?: string) => {
    setIsSaving(true);
    setFormData(nextFormData);
    const res = await fetch('/api/organizer/events/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nextFormData, changeSummary }),
    });
    setIsSaving(false);
    if (!res.ok) {
      toast.error('Failed to save draft');
      return false;
    }
    setLastSaved(new Date());
    return true;
  };

  const handleEventDetailsNext = async (data: EventDetailsFormData) => {
    const success = await saveDraft(data, 1);
    if (success) {
      setCompletedSteps(c => ({...c, 1: true}));
      setCurrentStep(2);
    }
  };

  const handleTicketClassesNext = async (data: TicketClass[]) => {
    const savedFormData = await saveDraft(data, 2);
    if (savedFormData) {
      setCompletedSteps(c => ({...c, 2: true}));
      const decision = deriveLayoutFromTicketClasses(data);
      setLayoutDecision(decision);
      if (decision.requiresLayout) {
        const generatedLayout = generateInitialLayoutFromTicketClasses(data);
        if (generatedLayout) {
          const generatedLayoutData: LayoutSetupData = {
            seatingConfig: generatedLayout,
            seatState: generatedLayout.seatState,
            summary: generatedLayout.summary,
          };
          const generatedAssignments = generateLayoutAssignments({
            ticketClasses: data,
            sections: generatedLayout.sections,
          });
          const nextFormData = {
            ...savedFormData,
            step3: generatedLayoutData,
            step4: generatedAssignments,
            lastCompletedStep: 2,
          };
          await persistDraft(nextFormData, "Generated initial layout and ticket assignments from ticket quantities");
        }
        setCompletedSteps(c => ({...c, 3: false, 4: false}));
        setCurrentStep(3);
      } else {
        setCompletedSteps(c => ({...c, 3: false, 4: false})); // Invalidate layout steps
        setCurrentStep(5);
      }
    }
  };

  const handleLayoutSetupNext = async (data: LayoutSetupData) => {
    if (!formData) {
      toast.error("Event draft is not available");
      return;
    }
    const nextAssignments = generateLayoutAssignments({
      ticketClasses: formData.step2 ?? [],
      sections: data.seatingConfig.sections,
      existingAssignments: formData.step4?.assignments,
      previousAutoAssignedTicketClassIds: formData.step4?.autoAssignedTicketClassIds,
    });
    const nextFormData = {
      ...formData,
      step3: data,
      step4: nextAssignments,
      lastCompletedStep: Math.max(formData?.lastCompletedStep ?? 0, 3),
    };
    const success = await persistDraft(nextFormData, "Saved customized layout and refreshed compatible ticket assignments");
    if (success) {
      setCompletedSteps(c => ({...c, 3: true}));
      setCurrentStep(4);
    }
  };

  const handleTicketAssignmentNext = async (assignmentData: LayoutAssignmentData) => {
    const success = await saveDraft(assignmentData, 4);
    if (success) {
      setCompletedSteps(c => ({...c, 4: true}));
      setCurrentStep(5);
    }
  };

  const canPublish = useMemo(() => {
      if (!completedSteps[1] || !completedSteps[2]) {
          return false;
      }
      if (layoutDecision.requiresLayout && (!completedSteps[3] || !completedSteps[4])) {
        return false;
      }
      return true;
  }, [completedSteps, layoutDecision.requiresLayout]);

  const validateForPublish = (): ValidationError[] => {
    const payload = buildPublishPayload(formData);
    const result = sharedEventSchema.safeParse(payload);
    if (result.success) {
      return [];
    }
    const validationErrors: ValidationError[] = [];
    const errors = result.error.flatten().fieldErrors;
    for (const [field, fieldErrors] of Object.entries(errors)) {
      const step = field === "ticketClasses" ? 2 : field === "layout" ? 3 : 1;
      validationErrors.push({ step, message: `${field}: ${(fieldErrors ?? []).join(", ")}` });
    }
    return validationErrors;
  }

  const handlePublish = async () => {
    const errors = validateForPublish();
    setValidationErrors(errors);

    if (errors.length > 0) {
        toast.error("Please fix the issues before publishing.");
        return;
    }
    const finalPayload = buildPublishPayload(formData);
    if (!canPublish || !finalPayload) return; // Should be caught by the above check
    
    setIsSaving(true);

    const res = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
    });

    setIsSaving(false);
    if (res.ok) {
        toast.success('Event submitted for approval!');
        await fetch('/api/organizer/events/draft', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(null) 
        });
        router.push('/organizer/events');
    } else {
        const errorPayload = await res.json();
        if (errorPayload.error.code === "VALIDATION_ERROR") {
          const fieldErrors = errorPayload.error.details.fieldErrors;
          const messages = Object.entries(fieldErrors).map(([field, errors]) => `${field}: ${(errors as string[]).join(", ")}`)
          toast.error("Invalid event data:", { description: messages.join("\n") });
        } else {
          toast.error(errorPayload?.error?.message ?? 'Failed to submit event');
        }
    }
  };

  const handlePrevious = () => {
    if (currentStep === 5 && !layoutDecision.requiresLayout) {
        setCurrentStep(2);
    } else {
        setCurrentStep(s => Math.max(1, s - 1));
    }
  }

  const goToStep = (stepNum: number) => {
      if (completedSteps[stepNum] || stepNum === currentStep) {
          setCurrentStep(stepNum);
      }
  }

  const handleRestoreDraft = (restoredFormData: unknown) => {
    if (!restoredFormData || typeof restoredFormData !== "object") {
      toast.error("Unable to restore draft");
      return;
    }
    const typedFormData = restoredFormData as EventFormData;
    setFormData(typedFormData);
    const decision = deriveLayoutFromTicketClasses(typedFormData.step2 ?? []);
    setLayoutDecision(decision);
    
    const lastCompleted = typedFormData.lastCompletedStep ?? 0;
    const newCompletedSteps: Record<number, boolean> = {};
    for (let i = 1; i <= lastCompleted; i++) {
        newCompletedSteps[i] = true;
    }
    setCompletedSteps(newCompletedSteps);

    let nextStepToResume = lastCompleted + 1;

    if (nextStepToResume === 3 && !decision.requiresLayout) {
        nextStepToResume = 5; 
    } else if (nextStepToResume === 4 && !decision.requiresLayout) {
        nextStepToResume = 5;
    }

    setCurrentStep(nextStepToResume > steps.length ? steps.length : nextStepToResume);
    setIsHistoryModalOpen(false);
    toast.success("Draft restored successfully");
  }

  if (loadingDraft) {
    return <div className="p-6">Loading draft...</div>;
  }

  return (
    <div>
      <DraftHistoryModal
        open={isHistoryModalOpen}
        onOpenChange={setIsHistoryModalOpen}
        history={draftHistory}
        onRestore={handleRestoreDraft}
      />
      <StepHeader 
        steps={steps} 
        currentStep={currentStep} 
        completedSteps={completedSteps} 
        isSaving={isSaving}
        lastSaved={lastSaved}
        onStepClick={goToStep}
        onViewHistory={() => setIsHistoryModalOpen(true)}
        errors={validationErrors.map(e => e.step)}
      />
      <div className="p-6">
        {currentStep === 1 && (
          <EventDetailsStep
            initialData={formData?.step1}
            onNext={handleEventDetailsNext}
          />
        )}

        {currentStep === 2 && (
            <TicketClassesStep 
                initialData={formData?.step2}
                onNext={handleTicketClassesNext} 
                onPrevious={handlePrevious}
            />
        )}

        {currentStep === 3 && layoutDecision.requiresLayout && (
            <LayoutSetupStep 
                initialData={formData?.step3}
                layoutType={layoutDecision.layoutType === "none" ? "seating" : layoutDecision.layoutType}
                onNext={handleLayoutSetupNext}
                onPrevious={handlePrevious}
                ticketClasses={formData?.step2}
                venueId={formData?.step1?.venueId}
            />
        )}

        {currentStep === 4 && layoutDecision.requiresLayout && (
            <TicketAssignmentStep
                ticketClasses={formData?.step2 ?? []}
                sections={(formData?.step3?.seatingConfig?.sections ?? []).map((section) => ({
                    id: section.id,
                    name: section.name,
                    mapType: section.mapType,
                    capacity: getSectionCapacity(section),
                }))}
                assignmentData={formData?.step4}
                onNext={handleTicketAssignmentNext}
                onPrevious={handlePrevious}
            />
        )}
        {currentStep === 5 && (
            <ReviewStep 
                formData={formData ?? {}}
                onPublish={handlePublish}
                onPrevious={handlePrevious}
                canPublish={canPublish}
                errors={validationErrors}
                goToStep={goToStep}
            />
        )}
      </div>
    </div>
  );
}
