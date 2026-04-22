'use client';

import { useState } from 'react';
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Trash2, Copy, Edit, Save } from 'lucide-react';
import type { EventTicketClass } from '@/src/types/event-draft';

type TicketCardProps = {
  ticket: EventTicketClass;
  onUpdate: (updatedTicket: EventTicketClass) => void;
  onDuplicate: (ticket: EventTicketClass) => void;
  onRemove: (id: string) => void;
};

export function TicketCard({ ticket, onUpdate, onDuplicate, onRemove }: TicketCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(ticket.name);
  const [price, setPrice] = useState(ticket.price.toString());
  const [quantity, setQuantity] = useState(ticket.quantity.toString());
  const [type, setType] = useState(ticket.type);

  const handleSave = () => {
    onUpdate({ ...ticket, name, price: Number(price), quantity: Number(quantity), type });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-2xl border-2 border-sky-500 bg-white p-4 shadow-sm space-y-4 w-full">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ticket Name" className="font-semibold text-lg" />
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className='text-xs text-neutral-500'>Price ($)</label>
                <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </div>
            <div>
                <label className='text-xs text-neutral-500'>Quantity</label>
                <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
            </div>
        </div>
        <div>
            <label className='text-xs text-neutral-500'>Ticket Type</label>
            <select className="app-select" value={type} onChange={(e) => setType(e.target.value as EventTicketClass["type"])}>
                <option value="general">General Admission (no assigned seats)</option>
                <option value="assigned_seat">Tickets for specific seats</option>
                <option value="table">Tickets for whole tables</option>
            </select>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-2" /> Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm flex justify-between items-center w-full">
      <div>
        <p className="font-semibold text-lg text-neutral-900">{ticket.name}</p>
        <p className="text-sm text-neutral-600">
          Price: ${ticket.price.toFixed(2)} | Quantity: {ticket.quantity} | Type: {ticket.type}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => onDuplicate(ticket)} title="Duplicate" className="h-9 w-9 p-0">
            <Copy className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} title="Edit" className="h-9 w-9 p-0">
            <Edit className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onRemove(ticket.id)} title="Remove" className="h-9 w-9 p-0 text-red-600 hover:bg-red-50 hover:text-red-700">
            <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
