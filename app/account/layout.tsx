import { ReactNode } from "react";
import { PublicNav } from "@/src/components/shared/public-nav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <PublicNav />
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
