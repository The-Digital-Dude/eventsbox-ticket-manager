'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";
import { Trash2 } from 'lucide-react';

export type TicketClass = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  classType: 'general' | 'seating' | 'table' | 'mixed';
};

type TicketClassesStepProps = {
  initialData?: TicketClass[];
  onNext: (data: TicketClass[]) => void;
  onPrevious: () => void;
};

export function TicketClassesStep({ initialData = [], onNext, onPrevious }: TicketClassesStepProps) {
  const [ticketClasses, setTicketClasses] = useState<TicketClass[]>(initialData);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [classType, setClassType] = useState<'general' | 'seating' | 'table' | 'mixed'>('general');

  const addTicketClass = () => {
    if (!name.trim()) return toast.error('Ticket class name is required');
    if (!price) return toast.error('Price is required');
    if (!quantity) return toast.error('Quantity is required');

    const newTicketClass: TicketClass = {
      id: new Date().toISOString(), // Temporary ID
      name,
      price: Number(price),
      quantity: Number(quantity),
      classType,
    };

    setTicketClasses([...ticketClasses, newTicketClass]);
    setName('');
    setPrice('');
    setQuantity('');
    setClassType('general');
  };

  const removeTicketClass = (id: string) => {
    setTicketClasses(ticketClasses.filter(tc => tc.id !== id));
  };

  const handleSubmit = () => {
    if (ticketClasses.length === 0) {
        return toast.error('Please add at least one ticket class');
    }
    onNext(ticketClasses);
  };

  return (
    <div className="space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-neutral-900">Add Ticket Class</h2>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                    <Label>Name <span className="text-red-500">*</span></Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. General Admission" />
                </div>
                <div className="space-y-2">
                    <Label>Price ($) <span className="text-red-500">*</span></Label>
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                    <Label>Quantity <span className="text-red-500">*</span></Label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </div>
                <div className="space-y-2 md:col-span-2">
                    <Label>Class Type</Label>
                    <select className="app-select" value={classType} onChange={(e) => setClassType(e.target.value as any)}>
                        <option value="general">General</option>
                        <option value="seating">Seating</option>
                        <option value="table">Table</option>
                        <option value="mixed">Mixed</option>
                    </select>
                    <p className="text-xs text-neutral-500">
                        Class type drives whether the event needs no layout, seating, table, or mixed setup.
                    </p>
                </div>
            </div>
            <Button className="mt-4" onClick={addTicketClass}>
                Add Ticket Class
            </Button>
        </section>

        {ticketClasses.length > 0 && (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-neutral-900">Ticket Classes</h2>
                <div className="space-y-3">
                    {ticketClasses.map((ticket) => (
                        <div key={ticket.id} className="rounded-xl border border-[var(--border)] p-4 flex justify-between items-center">
                            <div>
                                <p className="font-medium text-neutral-900">{ticket.name}</p>
                                <p className="text-sm text-neutral-500">Price: ${ticket.price.toFixed(2)} | Quantity: {ticket.quantity} | Type: {ticket.classType}</p>
                            </div>
                            <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => removeTicketClass(ticket.id)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </section>
        )}

        <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onPrevious}>Previous</Button>
            <Button onClick={handleSubmit}>Save & Continue</Button>
        </div>
    </div>
  );
}
