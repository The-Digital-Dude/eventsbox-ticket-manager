'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EventCreationWorkflow } from "@/src/components/organizer/event-creation-workflow";
import { ModeSelection } from "@/src/components/organizer/mode-selection";
import { SimpleEventForm, type SimpleEventData } from "@/src/components/organizer/simple-event-form";
import { nav } from "@/app/organizer/nav";

type Mode = 'selection' | 'simple' | 'advanced';

export default function NewEventPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('selection');
  const [isSaving, setIsSaving] = useState(false);

  const handleSimpleSubmit = async (data: SimpleEventData) => {
    setIsSaving(true);
    
    // Transform simple data into the format the backend expects
    const finalPayload = {
        title: data.title,
        startAt: new Date(data.startAt).toISOString(),
        venueName: data.venueName, // A new venue will be created on the backend
        ticketClasses: [
            {
                name: data.ticketName,
                price: data.price,
                quantity: data.quantity,
                classType: 'general', // Simple mode only allows general admission
            }
        ],
    };

    const res = await fetch('/api/organizer/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
    });

    setIsSaving(false);
    if (res.ok) {
        toast.success('Event created successfully!');
        router.push('/organizer/events');
    } else {
        const errorPayload = await res.json();
        toast.error(errorPayload?.error?.message ?? 'Failed to create event');
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'simple':
        return <SimpleEventForm isSaving={isSaving} onSubmit={handleSimpleSubmit} />;
      case 'advanced':
        return <EventCreationWorkflow />;
      case 'selection':
      default:
        return <ModeSelection onSelect={setMode} />;
    }
  };

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Create an Event" subtitle="Follow the steps to create and publish your event." />
      <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm mt-6">
        {renderContent()}
      </div>
    </SidebarLayout>
  );
}
