import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/src/components/ui/toaster";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EventsBox Ticket Manager",
  description: "Organizer onboarding and governance platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.className} bg-neutral-100 text-neutral-900 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
