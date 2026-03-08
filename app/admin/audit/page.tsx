import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { getServerSession } from "@/src/lib/auth/server-auth";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";

export const revalidate = 30;

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

function actionBadgeClass(action: string) {
  if (action.includes("APPROVED")) return "bg-emerald-100 text-emerald-700 border-transparent";
  if (action.includes("REJECTED") || action.includes("CANCEL")) return "bg-red-100 text-red-700 border-transparent";
  if (action.includes("SUSPENDED")) return "bg-orange-100 text-orange-700 border-transparent";
  if (action.includes("PUBLISHED")) return "bg-blue-100 text-blue-700 border-transparent";
  return "bg-neutral-100 text-neutral-600 border-transparent";
}

function formatAction(action: string) {
  return action.replace(/_/g, " ");
}

function fmtDateTime(d: Date) {
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; page?: string }>;
}) {
  const session = await getServerSession();
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/auth/login");

  const sp = await searchParams;
  const entityTypeFilter = sp.entityType ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const PAGE_SIZE = 50;

  const where = entityTypeFilter ? { entityType: entityTypeFilter } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        actor: { select: { email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const entityTypes = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Audit Log" subtitle={`${total.toLocaleString()} total entries`} />

      <div className="flex items-center gap-3">
        <form method="GET">
          <select name="entityType" defaultValue={entityTypeFilter} className="app-select" onChange={(e) => { const f = e.target.form; if (f) f.submit(); }}>
            <option value="">All entity types</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
            ))}
          </select>
        </form>
        {entityTypeFilter && (
          <a href="/admin/audit" className="text-sm text-[var(--theme-accent)] underline underline-offset-4">
            Clear filter
          </a>
        )}
      </div>

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-neutral-400">No audit entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)] bg-neutral-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Actor</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Entity</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-neutral-50 transition">
                    <td className="px-5 py-3 text-xs text-neutral-500 whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-neutral-700">{log.actor.email}</p>
                      <p className="text-xs text-neutral-400">{log.actor.role}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={actionBadgeClass(log.action)}>{formatAction(log.action)}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-xs font-medium text-neutral-700">{log.entityType}</p>
                      <p className="font-mono text-xs text-neutral-400 truncate max-w-[120px]">{log.entityId}</p>
                    </td>
                    <td className="px-5 py-3 text-xs text-neutral-500 max-w-[200px]">
                      {log.metadata ? (
                        <span className="truncate block">
                          {Object.entries(log.metadata as Record<string, unknown>)
                            .filter(([, v]) => v !== null && v !== undefined)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join("; ")
                          }
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <a
                href={`/admin/audit?${entityTypeFilter ? `entityType=${entityTypeFilter}&` : ""}page=${page - 1}`}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition"
              >
                ← Previous
              </a>
            )}
            {page < pages && (
              <a
                href={`/admin/audit?${entityTypeFilter ? `entityType=${entityTypeFilter}&` : ""}page=${page + 1}`}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 transition"
              >
                Next →
              </a>
            )}
          </div>
        </div>
      )}
    </SidebarLayout>
  );
}
