import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/src/components/ui/toaster";
import { getPlatformSettings } from "@/src/lib/services/platform-settings";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getPlatformSettings();
    return {
      title: settings.defaultMetaTitle ?? `${settings.platformName} Ticket Manager`,
      description: settings.defaultMetaDescription ?? "Event ticketing and management platform for organizers and attendees.",
      icons: settings.faviconUrl ? { icon: settings.faviconUrl } : undefined,
      robots: settings.searchIndexingEnabled ? undefined : { index: false, follow: false },
    };
  } catch {
    return {
      title: "EventsBox Ticket Manager",
      description: "Event ticketing and management platform for organizers and attendees.",
    };
  }
}

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
