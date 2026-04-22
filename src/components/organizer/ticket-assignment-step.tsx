'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import type { EventTicketClass, TicketMapping } from '@/src/types/event-draft';
import { Badge } from '@/src/components/ui/badge';

type Section = {
  id: string;
  name: string;
  mapType: 'seats' | 'table';
  capacity: number | null;
};

type Props = {
  ticketClasses: EventTicketClass[];
  sections: Section[];
  assignmentData: TicketMapping[];
  onNext: (mappings: TicketMapping[]) => void;
  onPrevious: () => void;
};

export function TicketAssignmentStep({ ticketClasses, sections, assignmentData, onNext, onPrevious }: Props) {
  const [mappings, setMappings] = useState<TicketMapping[]>(assignmentData);

  const handleMappingChange = (ticketClassId: string, targetId: string) => {
    setMappings(current => {
      const otherMappings = current.filter(m => m.ticketClassId !== ticketClassId);
      if (targetId) {
        return [...otherMappings, { ticketClassId, targetId }];
      } else {
        return otherMappings;
      }
    });
  };

  const handleSave = () => {
    // Basic validation: ensure all tickets that need mapping are mapped.
    const unmappedTicket = ticketClasses.find(tc => tc.type !== 'general' && !mappings.some(m => m.ticketClassId === tc.id));
    if (unmappedTicket) {
        toast.error(`Please assign the "${unmappedTicket.name}" ticket class to a section.`);
        return;
    }
    toast.success('Ticket assignments saved.');
    onNext(mappings);
  };

  const relevantTicketClasses = ticketClasses.filter(tc => tc.type !== 'general');

  return (
    <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Assign Tickets to Sections</h2>
            <p className="mt-1 text-sm text-neutral-600">Match each ticket class to a section in your venue layout. We&apos;ve made some initial assignments for you.</p>
        </section>

        {relevantTicketClasses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center shadow-sm">
                <h3 className="text-base font-medium text-neutral-800">No Tickets to Assign</h3>
                <p className="mt-2 text-sm text-neutral-600">All of your current ticket classes are General Admission and don&apos;t require assignment to a specific section.</p>
            </div>
        )}

      <div className="space-y-4">
        {relevantTicketClasses.map(ticketClass => {
          const compatibleSections = sections.filter(section => {
            if (ticketClass.type === 'assigned_seat') return section.mapType === 'seats';
            if (ticketClass.type === 'table') return section.mapType === 'table';
            return false;
          });

          const currentMapping = mappings.find(m => m.ticketClassId === ticketClass.id);
          const assignedSection = sections.find(s => s.id === currentMapping?.targetId);

          return (
            <div key={ticketClass.id} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-neutral-900">{ticketClass.name}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Type: {ticketClass.type} · Quantity: {ticketClass.quantity ?? 0}
                  </p>
                </div>
                <Badge>{ticketClass.type}</Badge>
              </div>

                <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
                  <label className="text-sm font-medium text-neutral-700">Assigned To Section</label>
                  {compatibleSections.length === 0 ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-sm font-medium text-amber-800">No Compatible Sections</p>
                        <p className="text-sm text-amber-700 mt-1">Please go back to the &apos;Seating&apos; step to create a section that can accommodate &apos;{ticketClass.type}&apos; tickets.</p>
                    </div>
                  ) : (
                    <select
                      className="block w-full rounded-xl border-neutral-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                      value={currentMapping?.targetId ?? ''}
                      onChange={e => handleMappingChange(ticketClass.id, e.target.value)}
                    >
                      <option value="">Not Assigned</option>
                      {compatibleSections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name} ({section.mapType}) - Capacity: {section.capacity ?? '-'}
                        </option>
                      ))}
                    </select>
                  )}
                  {assignedSection && (
                    <p className="text-xs text-neutral-500">
                      Assigned to <strong>{assignedSection.name}</strong>.
                    </p>
                  )}
                </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between border-t border-neutral-200 pt-5">
        <Button variant="outline" onClick={onPrevious}>
          Previous Step
        </Button>
        <Button onClick={handleSave}>
          Save & Continue
        </Button>
      </div>
    </div>
  );
}
