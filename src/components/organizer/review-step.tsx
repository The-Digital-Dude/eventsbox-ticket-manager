'use client';

import type React from "react";
import { Button } from "@/src/components/ui/button";
import { type EventDraft } from "@/src/types/event-draft";

type ReviewStepProps = {
    formData: EventDraft;
    onPublish: () => void;
    onPrevious: () => void;
    canPublish: boolean;
    errors: { step: number; message: string }[];
    goToStep: (stepNum: number) => void;
};

export function ReviewStep({ formData, onPublish, onPrevious, canPublish, errors, goToStep }: ReviewStepProps) {
    const { details } = formData;

    const renderDetail = (label: string, value: React.ReactNode) => (
        value ? <div><span className="font-medium">{label}:</span> {value}</div> : null
    );

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold">Review & Publish</h2>
            </section>

            {errors.length > 0 && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
                    <h3 className="mb-2 text-base font-semibold text-red-800">Please fix the following issues before publishing:</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
                        {errors.map((error, index) => (
                            <li key={`${error.step}-${index}`}>
                                <button type="button" onClick={() => goToStep(error.step)} className="underline hover:text-red-900">
                                    {error.message}
                                </button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {details && (
                <section className="rounded-2xl border bg-white p-6 shadow-sm">
                    <h3 className="text-base font-semibold">Event Details</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                        {renderDetail("Title", details.title)}
                        {renderDetail("Tagline", details.tagline)}
                        {details.schedule?.startsAt && renderDetail("Starts", new Date(details.schedule.startsAt).toLocaleString())}
                        {details.schedule?.endsAt && renderDetail("Ends", new Date(details.schedule.endsAt).toLocaleString())}
                        {details.schedule && renderDetail("Timezone", details.schedule.timezone)}
                    </div>
                </section>
            )}

            {details.location && (
                 <section className="rounded-2xl border bg-white p-6 shadow-sm">
                    <h3 className="text-base font-semibold">Location</h3>
                    {details.location.type === 'ONLINE' ? (
                        <div className="text-sm mt-4 space-y-1">
                           {renderDetail("Platform", details.location.platform)}
                           {renderDetail("Access Link", details.location.accessLink)}
                        </div>
                    ) : (
                        <div className="text-sm mt-4 space-y-1">
                           <p className="font-medium">{details.location.venueName}</p>
                           <p>{details.location.address}</p>
                           <p>{`${details.location.city}, ${details.location.state || ''} ${details.location.postalCode || ''}`.trim()}</p>
                           <p>{details.location.country}</p>
                        </div>
                    )}
                </section>
            )}

            {/* ... other review sections ... */}

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onPrevious}>Previous</Button>
                <Button onClick={onPublish} disabled={!canPublish}>Submit for Approval</Button>
            </div>
        </div>
    );
}
