'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Step, StepHeader } from './step-header';
import { EventDetailsStep } from './event-details-step';
import { TicketClassesStep, type TicketClass } from './ticket-classes-step';
import { LayoutSetupStep, type LayoutSetupData } from './layout-setup-step';
import { ReviewStep } from './review-step';
import { toast } from 'sonner';
import { deriveLayoutFromTicketClasses, type LayoutDecision } from '@/src/lib/layout-detector';

const steps: Step[] = [
  { num: 1, name: 'Event Details' },
  { num: 2, name: 'Ticket Classes' },
  { num: 3, name: 'Layout Setup' },
  { num: 4, name: 'Assignment' },
  { num: 5, name: 'Review & Publish' },
];

type EventFormData = {
    step1?: any;
    step2?: TicketClass[];
    step3?: LayoutSetupData;
    lastCompletedStep?: number;
}

export function EventCreationWorkflow() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Record<number, boolean>>({});
  const [formData, setFormData] = useState<EventFormData | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const [layoutDecision, setLayoutDecision] = useState<LayoutDecision>({ layoutType: 'none', requiresLayout: false });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    async function loadDraft() {
      const res = await fetch('/api/organizer/events/draft');
      const payload = await res.json();
      if (res.ok && payload.data) {
        setFormData(payload.data);
        const decision = deriveLayoutFromTicketClasses(payload.data.step2 ?? []);
        setLayoutDecision(decision);
        
        const lastCompleted = payload.data.lastCompletedStep ?? 0;
        const newCompletedSteps: Record<number, boolean> = {};
        for (let i = 1; i <= lastCompleted; i++) {
            newCompletedSteps[i] = true;
        }
        setCompletedSteps(newCompletedSteps);

        const nextStep = lastCompleted + 1;
        if (nextStep === 3 && !decision.requiresLayout) {
            setCurrentStep(5);
        } else {
            setCurrentStep(nextStep > steps.length ? steps.length : nextStep);
        }
      }
      setLoadingDraft(false);
    }
    loadDraft();
  }, []);

  const saveDraft = async (data: any, stepNum: number) => {
    setIsSaving(true);
    const newFormData = { ...formData, [`step${stepNum}`]: data, lastCompletedStep: stepNum };
    setFormData(newFormData);
    const res = await fetch('/api/organizer/events/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFormData),
    });
    setIsSaving(false);
    if (!res.ok) {
      toast.error('Failed to save draft');
      return false;
    }
    setLastSaved(new Date());
    return true;
  };

  const handleEventDetailsNext = async (data: any) => {
    const success = await saveDraft(data, 1);
    if (success) {
      setCompletedSteps(c => ({...c, 1: true}));
      setCurrentStep(2);
    }
  };

  const handleTicketClassesNext = async (data: TicketClass[]) => {
    const success = await saveDraft(data, 2);
    if (success) {
      setCompletedSteps(c => ({...c, 2: true}));
      const decision = deriveLayoutFromTicketClasses(data);
      setLayoutDecision(decision);
      if (decision.requiresLayout) {
        setCurrentStep(3);
      } else {
        setCurrentStep(5);
      }
    }
  };

  const handleLayoutSetupNext = async (data: LayoutSetupData) => {
    const success = await saveDraft(data, 3);
    if (success) {
      setCompletedSteps(c => ({...c, 3: true}));
      setCurrentStep(4);
    }
  };

  const canPublish = useMemo(() => {
      if (!completedSteps[1] || !completedSteps[2]) {
          return false;
      }
      if (layoutDecision.requiresLayout && (!completedSteps[3] /*|| !completedSteps[4]*/)) {
        return false;
      }
      return true;
  }, [completedSteps, layoutDecision.requiresLayout]);

  const handlePublish = async () => {
    if (!canPublish || !formData) return toast.error('Please complete all required steps');
    
    setIsSaving(true);
    // In a real implementation, this would be a structured object.
    // For now, we are just combining the form data from all steps.
    const finalPayload = {
        ...formData.step1,
        ticketClasses: formData.step2,
        layout: formData.step3,
    };

    const res = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
    });

    setIsSaving(false);
    if (res.ok) {
        toast.success('Event submitted for approval!');
        // Clear draft
        await fetch('/api/organizer/events/draft', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(null) 
        });
        router.push('/organizer/events');
    } else {
        const errorPayload = await res.json();
        toast.error(errorPayload?.error?.message ?? 'Failed to submit event');
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
      if (completedSteps[stepNum] || currentStep === stepNum) {
          setCurrentStep(stepNum);
      }
  }

  if (loadingDraft) {
    return <div className="p-6">Loading draft...</div>;
  }

  return (
    <div>
      <StepHeader 
        steps={steps} 
        currentStep={currentStep} 
        completedSteps={completedSteps} 
        isSaving={isSaving}
        lastSaved={lastSaved}
        onStepClick={goToStep}
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

        {currentStep === 3 && (
            <LayoutSetupStep 
                initialData={formData?.step3}
                layoutType={layoutDecision.layoutType as any}
                onNext={handleLayoutSetupNext}
                onPrevious={handlePrevious}
            />
        )}

        {currentStep === 4 && (
            <h2 className="text-xl font-semibold">Step 4: Assignment (Coming Soon)</h2>
        )}
        {currentStep === 5 && (
            <ReviewStep 
                formData={formData ?? {}}
                onPublish={handlePublish}
                onPrevious={handlePrevious}
                canPublish={canPublish}
            />
        )}
      </div>
    </div>
  );
}
