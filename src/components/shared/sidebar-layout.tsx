import Link from "next/link";
import { Badge } from "@/src/components/ui/badge";

export function SidebarLayout({
  role,
  title,
  items,
  children,
}: {
  role: "admin" | "organizer";
  title: string;
  items: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 via-white to-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 p-6 md:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <p className="font-semibold">{title}</p>
            <Badge>{role}</Badge>
          </div>
          <nav className="space-y-2">
            {items.map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100">
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="space-y-6">{children}</main>
      </div>
    </div>
  );
}
