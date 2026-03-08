import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/src/components/ui/toaster";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "EventsBox Ticket Manager",
  description: "Event ticketing and management platform for organizers and attendees.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="eventsbox-theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var saved = localStorage.getItem("eventsbox-theme");
                if (saved === "dark") document.documentElement.classList.add("theme-dark");
              } catch (_) {}
            })();
          `}
        </Script>
      </head>
      <body className={`${poppins.className} bg-[var(--page-bg)] text-neutral-900 antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
