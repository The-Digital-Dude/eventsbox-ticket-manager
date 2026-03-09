import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";

export const revalidate = 60;

export default async function AccountDashboardPage() {
  const session = await getServerSession();
  if (!session || session.user.role !== "ATTENDEE") {
    redirect("/auth/login");
  }

  const profile = await prisma.attendeeProfile.findUnique({
    where: { userId: session.user.id },
    include: { _count: { select: { orders: true } } },
  });

  if (!profile) {
    redirect("/auth/login");
  }

  const displayName = profile.displayName ?? session.user.email;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Welcome, {displayName}</h1>
        <p className="mt-2 text-sm text-neutral-600">Total orders: {profile._count.orders}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/account/orders" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Orders</h2>
          <p className="mt-2 text-sm text-neutral-600">View your paid and refunded order history.</p>
        </Link>

        <Link href="/account/tickets" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Tickets</h2>
          <p className="mt-2 text-sm text-neutral-600">Access your QR tickets for upcoming and past events.</p>
        </Link>

        <Link href="/account/profile" className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-sm transition hover:border-[var(--theme-accent)]">
          <h2 className="text-lg font-semibold text-neutral-900">My Profile</h2>
          <p className="mt-2 text-sm text-neutral-600">Update your display name and phone number.</p>
        </Link>
      </section>
    </div>
  );
}
