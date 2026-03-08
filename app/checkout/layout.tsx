import { PublicNav } from "@/src/components/shared/public-nav";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PublicNav />
      {children}
    </>
  );
}
