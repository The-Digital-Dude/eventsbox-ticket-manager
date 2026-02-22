"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  ClipboardCheck,
  ContactRound,
  Facebook,
  FileText,
  Globe,
  Hash,
  Link2,
  Mail,
  MapPin,
  MapPinHouse,
  Phone,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Button } from "@/src/components/ui/button";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

type StepId = "identity" | "contact" | "location" | "review";
type LocationRow = { id: string; name: string };
type StateRow = { id: string; name: string; cities: LocationRow[] };

type OnboardingForm = {
  companyName: string;
  brandName: string;
  website: string;
  phone: string;
  alternatePhone: string;
  supportEmail: string;
  facebookPage: string;
  socialMediaLink: string;
  contactName: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  stateId: string;
  cityId: string;
};

const stepOrder: StepId[] = ["identity", "contact", "location", "review"];

const stepMeta: Array<{
  id: StepId;
  label: string;
  icon: LucideIcon;
}> = [
  {
    id: "identity",
    label: "Business Identity",
    icon: Building2,
  },
  {
    id: "contact",
    label: "Contact & Compliance",
    icon: ContactRound,
  },
  {
    id: "location",
    label: "Address & Location",
    icon: MapPinHouse,
  },
  {
    id: "review",
    label: "Review & Submit",
    icon: ClipboardCheck,
  },
];

function LabelWithIcon({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Label className="inline-flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-[var(--theme-accent)]" />
      <span>{text}</span>
    </Label>
  );
}

export default function OrganizerOnboardingPage() {
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<StepId>("identity");
  const [states, setStates] = useState<StateRow[]>([]);
  const [form, setForm] = useState<OnboardingForm>({
    companyName: "",
    brandName: "",
    website: "",
    phone: "",
    alternatePhone: "",
    supportEmail: "",
    facebookPage: "",
    socialMediaLink: "",
    contactName: "",
    taxId: "",
    addressLine1: "",
    addressLine2: "",
    stateId: "",
    cityId: "",
  });

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/organizer/onboarding").then((response) => response.json()),
      fetch("/api/public/locations").then((response) => response.json()),
    ]).then(([onboardingPayload, locationsPayload]) => {
      if (!active) return;

      if (locationsPayload?.data) {
        setStates(locationsPayload.data ?? []);
      }

      if (onboardingPayload?.data) {
        const fromDbOptional = (value?: string | null) => (value && value !== "N/A" ? value : "");
        setForm({
          companyName: fromDbOptional(onboardingPayload.data.companyName),
          brandName: onboardingPayload.data.brandName === "N/A" ? "" : onboardingPayload.data.brandName ?? "",
          website: onboardingPayload.data.website === "N/A" ? "" : onboardingPayload.data.website ?? "",
          phone: fromDbOptional(onboardingPayload.data.phone),
          alternatePhone: onboardingPayload.data.alternatePhone === "N/A" ? "" : onboardingPayload.data.alternatePhone ?? "",
          supportEmail: onboardingPayload.data.supportEmail === "N/A" ? "" : onboardingPayload.data.supportEmail ?? "",
          facebookPage: onboardingPayload.data.facebookPage === "N/A" ? "" : onboardingPayload.data.facebookPage ?? "",
          socialMediaLink: onboardingPayload.data.socialMediaLink === "N/A" ? "" : onboardingPayload.data.socialMediaLink ?? "",
          contactName: fromDbOptional(onboardingPayload.data.contactName),
          taxId: fromDbOptional(onboardingPayload.data.taxId),
          addressLine1: fromDbOptional(onboardingPayload.data.addressLine1),
          addressLine2: fromDbOptional(onboardingPayload.data.addressLine2),
          stateId: onboardingPayload.data.stateId ?? "",
          cityId: onboardingPayload.data.cityId ?? "",
        });
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const cities = useMemo(() => states.find((state) => state.id === form.stateId)?.cities ?? [], [states, form.stateId]);

  const stepCompletion: Record<StepId, boolean> = {
    identity: Boolean(form.companyName.trim() && form.contactName.trim()),
    contact: Boolean(form.phone.trim()),
    location: Boolean(form.addressLine1.trim()),
    review: false,
  };

  const activeStepIndex = stepOrder.indexOf(activeStep);
  const completionProgress = Math.round(((activeStepIndex + 1) / stepOrder.length) * 100);

  function updateField<K extends keyof OnboardingForm>(key: K, value: OnboardingForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function canMoveNext(step: StepId) {
    if (step === "review") return true;
    if (!stepCompletion[step]) {
      if (step === "identity") {
        toast.error("Add company name and contact name to continue.");
      } else if (step === "contact") {
        toast.error("Add phone number to continue.");
      } else if (step === "location") {
        toast.error("Add address line 1 to continue.");
      }
      return false;
    }
    return true;
  }

  function goNextStep() {
    if (!canMoveNext(activeStep)) return;
    const nextIndex = Math.min(activeStepIndex + 1, stepOrder.length - 1);
    setActiveStep(stepOrder[nextIndex]);
  }

  function goPrevStep() {
    const prevIndex = Math.max(activeStepIndex - 1, 0);
    setActiveStep(stepOrder[prevIndex]);
  }

  async function saveOnboarding(submitForApproval: boolean) {
    if (submitForApproval) {
      const requiredReady = stepCompletion.identity && stepCompletion.contact && stepCompletion.location;
      if (!requiredReady) {
        toast.error("Complete required steps before submitting for approval.");
        return;
      }
    }

    setLoading(true);
    const res = await fetch("/api/organizer/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        taxId: form.taxId || undefined,
        addressLine2: form.addressLine2 || undefined,
        stateId: form.stateId || undefined,
        cityId: form.cityId || undefined,
        submit: submitForApproval,
      }),
    });

    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Failed to save onboarding");
      return;
    }

    toast.success(submitForApproval ? "Submitted for approval" : "Draft saved");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Organizer Onboarding" subtitle="Complete each step to unlock your organizer dashboard access." />

      <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Progress</h2>
            <p className="text-sm font-semibold text-[var(--theme-accent)]">
              {activeStepIndex + 1}/{stepOrder.length}
            </p>
          </div>

          <div className="mb-5 h-2 rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-[var(--theme-accent)] transition-all" style={{ width: `${completionProgress}%` }} />
          </div>

          <div className="space-y-2">
            {stepMeta.map((step, index) => {
              const Icon = step.icon;
              const isActive = step.id === activeStep;
              const isDone = stepCompletion[step.id] || stepOrder.indexOf(step.id) < activeStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(step.id)}
                  className={`relative w-full rounded-xl px-3 py-3 text-left transition ${
                    isActive ? "bg-[rgb(var(--theme-accent-rgb)/0.1)]" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold ${
                        isActive || isDone
                          ? "border-[var(--theme-accent)] bg-[var(--theme-accent)] text-white"
                          : "border-[var(--border)] bg-white text-neutral-500"
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <Icon className={`h-4 w-4 ${isActive || isDone ? "text-[var(--theme-accent)]" : "text-neutral-400"}`} />
                    <p className={`text-sm font-medium ${isActive ? "text-[var(--theme-accent)]" : "text-neutral-900"}`}>{step.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm md:p-7">
            {activeStep === "identity" ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Business Identity</h3>
                  <p className="text-sm text-neutral-600">Tell us who is operating this organizer account.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <LabelWithIcon icon={Building2} text="Company Name *" />
                    <Input value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={User} text="Contact Name *" />
                    <Input value={form.contactName} onChange={(e) => updateField("contactName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={FileText} text="Brand Name (Optional)" />
                    <Input value={form.brandName} onChange={(e) => updateField("brandName", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Globe} text="Website (Optional)" />
                    <Input value={form.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://example.com" />
                  </div>
                </div>
              </div>
            ) : null}

            {activeStep === "contact" ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Contact & Compliance</h3>
                  <p className="text-sm text-neutral-600">Add communication and compliance details for verification.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-2">
                    <LabelWithIcon icon={Phone} text="Phone *" />
                    <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Hash} text="Tax ID" />
                    <Input value={form.taxId} onChange={(e) => updateField("taxId", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Mail} text="Support Email (Optional)" />
                    <Input value={form.supportEmail} onChange={(e) => updateField("supportEmail", e.target.value)} placeholder="support@company.com" />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Phone} text="Alternate Phone (Optional)" />
                    <Input value={form.alternatePhone} onChange={(e) => updateField("alternatePhone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Facebook} text="Facebook Page (Optional)" />
                    <Input value={form.facebookPage} onChange={(e) => updateField("facebookPage", e.target.value)} placeholder="facebook.com/yourpage" />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={Link2} text="Other Social Link (Optional)" />
                    <Input value={form.socialMediaLink} onChange={(e) => updateField("socialMediaLink", e.target.value)} placeholder="instagram.com/... or x.com/..." />
                  </div>
                </div>
              </div>
            ) : null}

            {activeStep === "location" ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Address & Location</h3>
                  <p className="text-sm text-neutral-600">Provide your operational address to complete organizer profile.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <LabelWithIcon icon={MapPinHouse} text="Address Line 1 *" />
                    <Input value={form.addressLine1} onChange={(e) => updateField("addressLine1", e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <LabelWithIcon icon={MapPinHouse} text="Address Line 2" />
                    <Input value={form.addressLine2} onChange={(e) => updateField("addressLine2", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={MapPin} text="State" />
                    <select
                      className="app-select"
                      value={form.stateId}
                      onChange={(e) => {
                        updateField("stateId", e.target.value);
                        updateField("cityId", "");
                      }}
                    >
                      <option value="">Select state</option>
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <LabelWithIcon icon={MapPin} text="City" />
                    <select className="app-select" value={form.cityId} onChange={(e) => updateField("cityId", e.target.value)}>
                      <option value="">Select city</option>
                      {cities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {activeStep === "review" ? (
              <div className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight text-neutral-900">Review & Submit</h3>
                  <p className="text-sm text-neutral-600">Confirm details before sending profile for admin approval.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Company Name</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.companyName || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Contact Name</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.contactName || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Phone</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.phone || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Address</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.addressLine1 || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Website (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.website || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Brand Name (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.brandName || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Support Email (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.supportEmail || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Alternate Phone (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.alternatePhone || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Facebook Page (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.facebookPage || "-"}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-neutral-50 px-3 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Other Social Link (Optional)</p>
                    <p className="mt-1 text-sm font-medium text-neutral-900">{form.socialMediaLink || "-"}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-[rgb(var(--theme-accent-rgb)/0.24)] bg-[rgb(var(--theme-accent-rgb)/0.06)] p-3 text-sm text-neutral-700">
                  After submission, status will change to <span className="font-semibold">PENDING APPROVAL</span> for admin review.
                </div>
              </div>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm">
            <Button disabled={loading} variant="outline" onClick={() => saveOnboarding(false)}>
              {loading ? "Saving..." : "Save Draft"}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={activeStepIndex === 0 || loading} onClick={goPrevStep}>
                Back
              </Button>
              {activeStep !== "review" ? (
                <Button disabled={loading} onClick={goNextStep}>
                  Next Step
                </Button>
              ) : (
                <Button disabled={loading} onClick={() => saveOnboarding(true)}>
                  {loading ? "Submitting..." : "Submit for Approval"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </SidebarLayout>
  );
}
