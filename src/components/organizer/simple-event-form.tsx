'use client';

import { useState } from "react";
import { toast } from "sonner";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

export type SimpleEventData = {
  title: string;
  startAt: string;
  venueName: string;
  ticketName: string;
  price: number;
  quantity: number;
};

type SimpleEventFormProps = {
  isSaving: boolean;
  onSubmit: (data: SimpleEventData) => void;
};

export function SimpleEventForm({ isSaving, onSubmit }: SimpleEventFormProps) {
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [ticketName, setTicketName] = useState("General Admission");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");

  const handleSubmit = () => {
    if (!title.trim() || !startAt || !venueName.trim() || !ticketName.trim() || !price || !quantity) {
      return toast.error("Please fill out all fields.");
    }

    onSubmit({
      title,
      startAt,
      venueName,
      ticketName,
      price: Number(price),
      quantity: Number(quantity),
    });
  };

  return (
    <div className="p-8 space-y-8">
        <section className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-900">Create a Simple Event</h2>
            <p className="text-sm text-neutral-600">Fill in the essentials to get your event published quickly.</p>
            <div className="space-y-2">
                <Label>Event Name <span className="text-red-500">*</span></Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Block Party" />
            </div>
            <div className="space-y-2">
                <Label>Date & Time <span className="text-red-500">*</span></Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Venue Name <span className="text-red-500">*</span></Label>
                <Input value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="e.g. Central Park" />
            </div>
        </section>

        <section className="space-y-4">
            <h2 className="text-xl font-semibold text-neutral-900">Your Ticket</h2>
            <p className="text-sm text-neutral-600">Create one general admission ticket type for this event.</p>
            <div className="space-y-2">
                <Label>Ticket Name <span className="text-red-500">*</span></Label>
                <Input value={ticketName} onChange={(e) => setTicketName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Price ($) <span className="text-red-500">*</span></Label>
                    <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                    <Label>Quantity <span className="text-red-500">*</span></Label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" />
                </div>
            </div>
        </section>

        <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Publishing..." : "Publish Event"}
            </Button>
        </div>
    </div>
  );
}
