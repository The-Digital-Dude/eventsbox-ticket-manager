import { PublicNav } from "@/src/components/shared/public-nav";

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
