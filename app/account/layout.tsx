import { ReactNode } from "react";
import { PublicNav } from "@/src/components/shared/public-nav";
import { AccountNav } from "@/src/components/shared/AccountNav";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--page-bg)]">
      <PublicNav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <AccountNav />
        {children}
      </main>
    </div>
  );
}
