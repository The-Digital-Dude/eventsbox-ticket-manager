'use client';

import { Button } from "@/src/components/ui/button";
import { type TicketClass } from "./ticket-classes-step";
import { type LayoutSetupData } from "./layout-setup-step";
import { AlertCircle } from "lucide-react";
import type { EventDetailsFormData } from "@/src/types/event-form-data";

type ValidationError = {
    step: number;
    message: string;
}

type ReviewStepProps = {
    formData: {
        step1?: EventDetailsFormData; 
        step2?: TicketClass[];
        step3?: LayoutSetupData;
    };
    onPublish: () => void;
    onPrevious: () => void;
    canPublish: boolean;
    errors: ValidationError[];
    goToStep: (stepNum: number) => void;
};

export function ReviewStep({ formData, onPublish, onPrevious, canPublish, errors, goToStep }: ReviewStepProps) {
    const { step1, step2, step3 } = formData;

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-neutral-900">Review & Publish</h2>
                <p className="text-sm text-neutral-600">Review all the details of your event below. You can go back to any step to make corrections before submitting for approval.</p>
            </section>

            {errors.length > 0 && (
                 <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
                    <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                        <div>
                            <h3 className="mb-2 text-base font-semibold text-red-800">Please fix the following issues before publishing:</h3>
                            <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
                                {errors.map((error, index) => (
                                    <li key={index}>
                                        <button onClick={() => goToStep(error.step)} className="underline hover:text-red-900">
                                            {error.message}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            )}

            {step1 && (
                <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-base font-semibold text-neutral-900">Event Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><span className="font-medium">Title:</span> {step1.title}</div>
                        <div><span className="font-medium">Starts:</span> {new Date(step1.startAt).toLocaleString()}</div>
                        <div><span className="font-medium">Ends:</span> {new Date(step1.endAt).toLocaleString()}</div>
                        <div><span className="font-medium">Timezone:</span> {step1.timezone}</div>
                    </div>
                </section>
            )}

            {step2 && (
                <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-base font-semibold text-neutral-900">Ticket Classes</h3>
                    <div className="space-y-2">
                        {step2.map(tc => (
                            <div key={tc.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
                                <p className="font-medium">{tc.name}</p>
                                <p className="text-neutral-600">Price: ${tc.price.toFixed(2)} | Quantity: {tc.quantity} | Type: {tc.classType}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {step3 && (
                <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-base font-semibold text-neutral-900">Layout Summary</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                        <div><span className="font-medium">Total Seats:</span> {step3.summary.totalSeats}</div>
                        <div><span className="font-medium">Total Tables:</span> {step3.summary.totalTables}</div>
                        <div><span className="font-medium">Sections:</span> {step3.summary.sectionCount}</div>
                    </div>
                </section>
            )}

            <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={onPrevious}>Previous</Button>
                <Button onClick={onPublish} disabled={!canPublish}>
                    Submit for Approval
                </Button>
            </div>
        </div>
    );
}
