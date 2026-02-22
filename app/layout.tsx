import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/src/components/ui/toaster";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "EventsBox Ticket Manager",
  description: "Organizer onboarding and governance platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${poppins.className} bg-neutral-100 text-neutral-900 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
