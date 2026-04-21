'use client';

import { Button } from "@/src/components/ui/button";
import { Zap, Settings } from 'lucide-react';

type ModeSelectionProps = {
    onSelect: (mode: 'simple' | 'advanced') => void;
};

export function ModeSelection({ onSelect }: ModeSelectionProps) {
    return (
        <div className="p-8">
            <h2 className="text-center text-2xl font-bold text-neutral-900 mb-2">What kind of event are you creating?</h2>
            <p className="text-center text-neutral-600 mb-8">Choose a setup that fits your needs. You can always switch to advanced mode later.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <div className="rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center text-center">
                    <div className="bg-yellow-100 text-yellow-600 rounded-full p-3 mb-4">
                        <Zap className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">A Simple Event</h3>
                    <p className="text-sm text-neutral-600 mb-6">Best for quick setup with general admission tickets. Get your event live in minutes.</p>
                    <Button onClick={() => onSelect('simple')} className="w-full">Start with Simple Mode</Button>
                </div>
                <div className="rounded-2xl border border-[var(--border)] p-6 flex flex-col items-center text-center">
                    <div className="bg-sky-100 text-sky-600 rounded-full p-3 mb-4">
                        <Settings className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-2">A Custom Event</h3>
                    <p className="text-sm text-neutral-600 mb-6">For events with assigned seating, multiple ticket tiers, or other special requirements.</p>
                    <Button onClick={() => onSelect('advanced')} className="w-full" variant="outline">Use Advanced Setup</Button>
                </div>
            </div>
        </div>
    );
}
