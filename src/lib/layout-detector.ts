import { TicketClassType } from '@prisma/client';
import type { TicketClass } from "@/src/components/organizer/ticket-classes-step";

export type LayoutType = 'none' | 'seating' | 'table' | 'mixed';

export type LayoutDecision = {
  layoutType: LayoutType;
  requiresLayout: boolean;
};

export function deriveLayoutFromTicketClasses(ticketClasses: Pick<TicketClass, 'classType'>[]): LayoutDecision {
  const classTypes = new Set(ticketClasses.map(tc => tc.classType));

  const hasSeating = classTypes.has(TicketClassType.ASSIGNED_SEAT);
  const hasTable = classTypes.has(TicketClassType.TABLE);

  if (hasSeating && hasTable) {
    return {
      layoutType: 'mixed',
      requiresLayout: true,
    };
  }

  if (hasTable) {
    return {
      layoutType: 'table',
      requiresLayout: true,
    };
  }

  if (hasSeating) {
    return {
      layoutType: 'seating',
      requiresLayout: true,
    };
  }

  return {
    layoutType: 'none',
    requiresLayout: false,
  };
}
