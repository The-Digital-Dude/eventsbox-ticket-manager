import { redirect } from "next/navigation";
import { OrganizerApprovalStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
];

export default async function OrganizerDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ORGANIZER") {
    redirect("/auth/login");
  }

  const profile = await prisma.organizerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile || profile.approvalStatus !== OrganizerApprovalStatus.APPROVED) {
    redirect("/organizer/status");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Organizer Dashboard" subtitle="Your account is approved. Event tools unlock in next phase." />
      <Card>
        <CardHeader><CardTitle>Phase 0/1 Access Enabled</CardTitle></CardHeader>
        <CardContent className="text-sm text-neutral-600">You can now manage payout setup and venue requests.</CardContent>
      </Card>
    </SidebarLayout>
  );
}
