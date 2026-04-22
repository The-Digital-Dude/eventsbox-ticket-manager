'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from "@/src/components/ui/button";
import { TicketCard } from './ticket-card';
import { PlusCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { EventTicketClass } from "@/src/types/event-draft";
import { validateStep } from '@/src/lib/event-engine';
import type { EventDraft } from "@/src/types/event-draft";

type TicketClassesStepProps = {
  initialData?: EventTicketClass[];
  onNext: (data: EventTicketClass[]) => void;
  onPrevious: () => void;
};

export function TicketClassesStep({ initialData = [], onNext, onPrevious }: TicketClassesStepProps) {
  const [ticketClasses, setTicketClasses] = useState<EventTicketClass[]>(initialData);

  const addTicketClass = () => {
    const newTicketClass: EventTicketClass = {
      id: new Date().toISOString(), // Temporary ID
      name: 'New Ticket',
      price: 0,
      quantity: 100,
      type: "general",
    };
    setTicketClasses([...ticketClasses, newTicketClass]);
  };

  const updateTicketClass = (updatedTicket: EventTicketClass) => {
    setTicketClasses(ticketClasses.map(tc => tc.id === updatedTicket.id ? updatedTicket : tc));
  };

  const duplicateTicketClass = (ticketToDuplicate: EventTicketClass) => {
    const newTicketClass: EventTicketClass = {
      ...ticketToDuplicate,
      id: new Date().toISOString(),
      name: `${ticketToDuplicate.name} (Copy)`,
    };
    setTicketClasses([...ticketClasses, newTicketClass]);
  };

  const removeTicketClass = (id: string) => {
    setTicketClasses(ticketClasses.filter(tc => tc.id !== id));
  };

  const moveTicketClass = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === ticketClasses.length - 1)
    ) {
      return;
    }
    const newTicketClasses = [...ticketClasses];
    const item = newTicketClasses.splice(index, 1)[0];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    newTicketClasses.splice(newIndex, 0, item);
    setTicketClasses(newTicketClasses);
  };

  const handleSubmit = () => {
    const draftForValidation: EventDraft = {
      details: {},
      ticketClasses,
      seatingLayout: {},
      ticketMappings: [],
      meta: {
        lastCompletedStep: 1,
        version: 0,
        lastSaved: new Date().toISOString(),
        isPublished: false,
      },
    };
    const issues = validateStep(draftForValidation, 2);
    if (issues.length > 0) {
      toast.error("Invalid ticket classes:", { description: issues.map(i => i.message).join("\n") });
      return;
    }
    onNext(ticketClasses);
  };

  return (
    <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Your Ticket Options</h2>
            <p className="text-sm text-neutral-600 mb-6">Create the different tickets you want to offer for your event. You can add, edit, duplicate, and reorder them.</p>
            
            <div className="space-y-4">
              {ticketClasses.map((ticket, index) => (
                <div key={ticket.id} className="flex items-center gap-2">
                    <TicketCard 
                      ticket={ticket} 
                      onUpdate={updateTicketClass}
                      onDuplicate={duplicateTicketClass}
                      onRemove={removeTicketClass}
                    />
                    <div className="flex flex-col gap-1">
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => moveTicketClass(index, 'up')} disabled={index === 0} title="Move Up">
                            <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={() => moveTicketClass(index, 'down')} disabled={index === ticketClasses.length - 1} title="Move Down">
                            <ArrowDown className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
              ))}
            </div>

            <Button className="mt-6" variant="outline" onClick={addTicketClass}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add a Ticket
            </Button>
        </section>

        <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onPrevious}>Back</Button>
            <Button onClick={handleSubmit}>Next: Seating</Button>
        </div>
    </div>
  );
}
