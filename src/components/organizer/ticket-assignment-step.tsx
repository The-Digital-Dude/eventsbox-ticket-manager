
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import type { TicketClass } from './ticket-classes-step';
import { TicketClassType } from '@prisma/client';
import type { LayoutAssignmentData } from '@/src/lib/layout-auto-generator';

type Section = {
  id: string;
  name: string;
  mapType: 'seats' | 'table';
  capacity: number | null;
};

type Props = {
  ticketClasses: TicketClass[];
  sections: Section[];
  assignmentData?: LayoutAssignmentData;
  onNext: (assignmentData: LayoutAssignmentData) => void;
  onPrevious: () => void;
};

export function TicketAssignmentStep({ ticketClasses, sections, assignmentData, onNext, onPrevious }: Props) {
  const [assignments, setAssignments] = useState<Record<string, string>>(assignmentData?.assignments ?? {});
  const [autoAssignedTicketClassIds, setAutoAssignedTicketClassIds] = useState<string[]>(
    assignmentData?.autoAssignedTicketClassIds ?? [],
  );

  const handleSave = () => {
    toast.success('Ticket assignments saved.');
    onNext({ assignments, autoAssignedTicketClassIds });
  };

  return (
    <div className="space-y-6">


      <div className="space-y-4">
        {ticketClasses.map(ticketClass => {
          const compatibleSections = sections.filter(section => {
            if (ticketClass.classType === TicketClassType.GENERAL_ADMISSION) return false;
            if (ticketClass.classType === TicketClassType.ASSIGNED_SEAT) return section.mapType === 'seats';
            if (ticketClass.classType === TicketClassType.TABLE) return section.mapType === 'table';
            return false;
          });

          const assignedSection = sections.find(s => s.id === assignments[ticketClass.id]);
          const isAutoAssigned = autoAssignedTicketClassIds.includes(ticketClass.id) && Boolean(assignedSection);

          return (
            <div key={ticketClass.id} className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-neutral-900">{ticketClass.name}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    Type: {ticketClass.classType} · Quantity: {ticketClass.quantity ?? 0}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAutoAssigned ? (
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Auto-assigned</Badge>
                  ) : null}
                  <Badge>{ticketClass.classType}</Badge>
                </div>
              </div>

              {ticketClass.classType === TicketClassType.GENERAL_ADMISSION ? (
                <p className="mt-3 text-sm text-neutral-500">
                  General admission classes do not require a seating or table mapping.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Assigned To</label>
                  {compatibleSections.length === 0 ? (
                    <p className="text-sm text-neutral-500">
                      No compatible sections available. Go back to the layout step to create them.
                    </p>
                  ) : (
                    <select
                      className="app-select"
                      value={assignments[ticketClass.id] ?? ''}
                      onChange={event => {
                        setAssignments(current => ({
                          ...current,
                          [ticketClass.id]: event.target.value,
                        }));
                        setAutoAssignedTicketClassIds(current => current.filter(id => id !== ticketClass.id));
                      }}
                    >
                      <option value="">Unassigned</option>
                      {compatibleSections.map(section => (
                        <option key={section.id} value={section.id}>
                          {section.name} ({section.mapType}) - Capacity: {section.capacity ?? 'Unbounded'}
                        </option>
                      ))}
                    </select>
                  )}
                  {assignedSection ? (
                    <p className="text-xs text-neutral-500">
                      Assigned to {assignedSection.name} with a capacity of {assignedSection.capacity ?? 'unbounded'}.
                    </p>
                  ) : (
                     <p className="text-xs text-neutral-500">
                        Not yet assigned to a section.
                    </p>
                  )}
                </div>
              )}
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
