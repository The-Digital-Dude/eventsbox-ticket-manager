import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { EventCreationWorkflow } from "@/src/components/organizer/event-creation-workflow";
import { nav } from "@/app/organizer/nav";

export default function NewEventPage() {
  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Create an Event" subtitle="Follow the steps to create and publish your event." />
      <div className="rounded-2xl border border-[var(--border)] bg-white shadow-sm mt-6">
        <EventCreationWorkflow />
      </div>
    </SidebarLayout>
  );
}
