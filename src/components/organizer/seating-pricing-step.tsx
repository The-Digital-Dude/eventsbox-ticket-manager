'use client';

import { RelationalSeatingLayout, SeatingZone } from "@/src/types/event-draft";
import { EventSeatingSectionType } from "@prisma/client";
import { useState } from "react";

interface SeatingPricingStepProps {
  initialData: RelationalSeatingLayout | null;
  onNext: (data: RelationalSeatingLayout) => void;
  onPrevious: () => void;
}

export function SeatingPricingStep({ initialData, onNext, onPrevious }: SeatingPricingStepProps) {
  const [seatingLayout, setSeatingLayout] = useState<RelationalSeatingLayout | null>(initialData);

  const handleAddZone = () => {
    const newZone: SeatingZone = {
      id: `new-${Date.now()}`,
      key: `zone-${Date.now()}`,
      name: "New Zone",
      sectionType: "SECTIONED_GA",
      capacity: 100,
      price: 20,
      sortOrder: seatingLayout?.sections.length ?? 0,
      eventSeatingPlanId: seatingLayout?.id ?? "",
      generatedTicketTypeId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setSeatingLayout(prev => {
      if (!prev) {
        return {
            id: `plan-${Date.now()}`,
            eventId: "", // This will be set on the server
            mode: "MIXED",
            source: "CUSTOM",
            venueSeatingTemplateId: null,
            sourceVenueId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            sections: [newZone]
        };
      }
      return {
        ...prev,
        sections: [...prev.sections, newZone]
      }
    });
  };

  const handleZoneChange = (key: string, field: keyof SeatingZone, value: string | number) => {
    setSeatingLayout(prev => {
        if (!prev) return null;
        return {
            ...prev,
            sections: prev.sections.map(zone => {
                if (zone.key === key) {
                    return { ...zone, [field]: value };
                }
                return zone;
            })
        }
    });
  };

  const handleRemoveZone = (key: string) => {
    setSeatingLayout(prev => {
        if (!prev) return null;
        return {
            ...prev,
            sections: prev.sections.filter(zone => zone.key !== key)
        }
    });
  };

  const handleNext = () => {
    if (seatingLayout) {
      onNext(seatingLayout);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold">Seating & Pricing</h2>
      <p className="text-gray-500 mb-6">Define the sections of your event and set a price for each.</p>

      <div className="space-y-4">
        {seatingLayout?.sections.map((zone, index) => (
          <div key={zone.key} className="p-4 border rounded-lg grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Zone Name</label>
                <input type="text" value={zone.name} onChange={(e) => handleZoneChange(zone.key, 'name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Price</label>
                <input type="number" value={zone.price} onChange={(e) => handleZoneChange(zone.key, 'price', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Capacity</label>
                <input type="number" value={zone.capacity} onChange={(e) => handleZoneChange(zone.key, 'capacity', Number(e.target.value))} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
            </div>
            <div className="col-span-1 md:col-span-3">
                <label className="block text-sm font-medium text-gray-700">Section Type</label>
                <select value={zone.sectionType} onChange={(e) => handleZoneChange(zone.key, 'sectionType', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    {Object.values(EventSeatingSectionType).map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>
            <div>
                <button onClick={() => handleRemoveZone(zone.key)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={handleAddZone} className="mt-4 px-4 py-2 border rounded-lg">
        + Add Zone
      </button>

      <div className="flex justify-end gap-4 mt-8">
        <button onClick={onPrevious} className="px-6 py-2 border rounded-lg">Previous</button>
        <button onClick={handleNext} className="px-6 py-2 bg-black text-white rounded-lg">Next</button>
      </div>
    </div>
  );
}