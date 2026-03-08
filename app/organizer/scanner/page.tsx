"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock3, ScanLine, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/analytics", label: "Analytics" },
  { href: "/organizer/payout", label: "Payout" },
  { href: "/organizer/venues", label: "Venues" },
  { href: "/organizer/scanner", label: "Scanner" },
];

type CheckInResult = {
  alreadyCheckedIn: boolean;
  checkedInAt: string;
  ticketNumber: string;
  eventTitle: string;
  buyerName?: string;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// BarcodeDetector is a browser API — not in TypeScript's lib yet
declare class BarcodeDetector {
  static getSupportedFormats(): Promise<string[]>;
  constructor(options: { formats: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>>;
}

export default function ScannerPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; data?: CheckInResult; error?: string } | null>(null);
  const [history, setHistory] = useState<Array<{ token: string; result: CheckInResult; ts: string }>>([]);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");

  useEffect(() => {
    // Check if BarcodeDetector and camera are supported
    const supported =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      typeof navigator?.mediaDevices?.getUserMedia === "function";
    setCameraSupported(supported); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const stopCamera = useCallback(() => {
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    lastScannedRef.current = "";
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      detectorRef.current = new BarcodeDetector({ formats: ["qr_code"] });
      setCameraActive(true);
      scanLoop();
    } catch {
      toast.error("Could not access camera. Check permissions.");
    }
  }

  function scanLoop() {
    async function frame() {
      if (!videoRef.current || !detectorRef.current || !streamRef.current) return;
      if (videoRef.current.readyState >= 2) {
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          for (const barcode of barcodes) {
            const val = barcode.rawValue.trim();
            if (val && val !== lastScannedRef.current) {
              lastScannedRef.current = val;
              stopCamera();
              await handleCheckin(val);
              return;
            }
          }
        } catch {
          // detection frame error — continue
        }
      }
      scanFrameRef.current = requestAnimationFrame(frame);
    }
    scanFrameRef.current = requestAnimationFrame(frame);
  }

  async function handleCheckin(tkn = token) {
    const t = tkn.trim();
    if (!t) return toast.error("Enter a ticket token");
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/organizer/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setResult({ ok: false, error: payload?.error?.message ?? "Check-in failed" });
      return;
    }

    const data: CheckInResult = payload.data;
    setResult({ ok: true, data });
    setHistory((prev) => [{ token: t, result: data, ts: new Date().toISOString() }, ...prev.slice(0, 19)]);
    setToken("");
  }

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Ticket Scanner" subtitle="Check in attendees by scanning their QR code or entering a ticket token." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,480px)_1fr]">
        {/* Scanner panel */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ScanLine className="h-5 w-5 text-[var(--theme-accent)]" />
              <h2 className="text-lg font-semibold text-neutral-900">Scan or Enter Token</h2>
            </div>

            {/* Camera viewfinder */}
            {cameraActive && (
              <div className="relative mb-4 overflow-hidden rounded-xl border-2 border-[var(--theme-accent)] bg-black aspect-square w-full max-w-xs mx-auto">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {/* Scanning overlay */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-2/3 w-2/3 rounded-xl border-2 border-white/70">
                    <div className="h-1 w-8 rounded-full bg-[var(--theme-accent)] animate-pulse" />
                  </div>
                </div>
                <button
                  onClick={stopCamera}
                  className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 transition"
                >
                  <CameraOff className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              {/* Camera button */}
              {cameraSupported && !cameraActive && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={startCamera}
                  disabled={loading}
                >
                  <Camera className="h-4 w-4" />
                  Scan QR Code with Camera
                </Button>
              )}

              {/* Manual entry */}
              <div className="space-y-1.5">
                <Label>Token / QR value</Label>
                <Input
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCheckin(); }}
                  placeholder="Paste or type ticket token..."
                  autoFocus={!cameraActive}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => handleCheckin()}
                disabled={loading || !token.trim()}
              >
                {loading ? "Checking in..." : "Check In"}
              </Button>
            </div>
          </section>

          {/* Result card */}
          {result && (
            <section className={`rounded-2xl border p-6 shadow-sm ${
              !result.ok
                ? "border-red-200 bg-red-50"
                : result.data?.alreadyCheckedIn
                  ? "border-amber-200 bg-amber-50"
                  : "border-emerald-200 bg-emerald-50"
            }`}>
              {!result.ok ? (
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900">Check-in Failed</p>
                    <p className="mt-1 text-sm text-red-700">{result.error}</p>
                  </div>
                </div>
              ) : result.data?.alreadyCheckedIn ? (
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">Already Checked In</p>
                    <p className="mt-1 text-sm text-amber-700">
                      Ticket <span className="font-mono">{result.data.ticketNumber}</span> was checked in at {formatDateTime(result.data.checkedInAt)}.
                    </p>
                    <p className="mt-0.5 text-sm text-amber-700">{result.data.eventTitle}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900">Check-in Successful!</p>
                    <p className="mt-1 text-sm text-emerald-700">
                      <span className="font-mono">{result.data?.ticketNumber}</span>
                      {result.data?.buyerName ? ` · ${result.data.buyerName}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-emerald-700">{result.data?.eventTitle}</p>
                    {/* Scan another prompt */}
                    {cameraSupported && (
                      <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={startCamera}>
                        <Camera className="h-3.5 w-3.5" />
                        Scan next ticket
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* History */}
        <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">Session History</h2>
            {history.length > 0 && (
              <span className="rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent)]">
                {history.length}
              </span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-neutral-400">No check-ins yet this session.</p>
          ) : (
            <div className="space-y-2">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${
                    entry.result.alreadyCheckedIn
                      ? "border-amber-100 bg-amber-50"
                      : "border-emerald-100 bg-emerald-50"
                  }`}
                >
                  {entry.result.alreadyCheckedIn
                    ? <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  }
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-neutral-500">{entry.result.ticketNumber}</p>
                    <p className="mt-0.5 font-medium text-neutral-900 truncate">{entry.result.eventTitle}</p>
                    {entry.result.buyerName && <p className="text-xs text-neutral-500">{entry.result.buyerName}</p>}
                    <p className="mt-0.5 text-xs text-neutral-400">{formatDateTime(entry.ts)}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    entry.result.alreadyCheckedIn ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {entry.result.alreadyCheckedIn ? "Duplicate" : "OK"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </SidebarLayout>
  );
}
