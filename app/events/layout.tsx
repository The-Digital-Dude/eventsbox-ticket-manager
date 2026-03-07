import { PublicNav } from "@/src/components/shared/public-nav";

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
