"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, Clock3, ScanLine, Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const nav = [
  { href: "/organizer/status", label: "Status" },
  { href: "/organizer/onboarding", label: "Onboarding" },
  { href: "/organizer/dashboard", label: "Dashboard" },
  { href: "/organizer/events", label: "Events" },
  { href: "/organizer/promo-codes", label: "Promo Codes" },
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

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");

  useEffect(() => {
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
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    lastScannedRef.current = "";
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    if (!cameraSupported) {
      toast.error("Camera scanner is not supported on this browser.");
      return;
    }

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
            const value = barcode.rawValue.trim();
            if (value && value !== lastScannedRef.current) {
              lastScannedRef.current = value;
              stopCamera();
              await handleCheckin(value);
              return;
            }
          }
        } catch {
          // Continue scanning on frame errors
        }
      }
      scanFrameRef.current = requestAnimationFrame(frame);
    }
    scanFrameRef.current = requestAnimationFrame(frame);
  }

  async function handleCheckin(scannedToken = token) {
    const value = scannedToken.trim();
    if (!value) return toast.error("Enter a ticket token");
    setLoading(true);
    setResult(null);

    const res = await fetch("/api/organizer/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: value }),
    });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      setResult({ ok: false, error: payload?.error?.message ?? "Check-in failed" });
      return;
    }

    const data: CheckInResult = payload.data;
    setResult({ ok: true, data });
    setHistory((prev) => [{ token: value, result: data, ts: new Date().toISOString() }, ...prev.slice(0, 19)]);
    setToken("");
  }

  const successCount = history.filter((entry) => !entry.result.alreadyCheckedIn).length;
  const duplicateCount = history.filter((entry) => entry.result.alreadyCheckedIn).length;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader title="Ticket Scanner" subtitle="Phone-first check-in flow: scan QR codes quickly or enter token manually." />

      <div className="space-y-4 sm:space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">This Session</p>
            <p className="mt-1 text-2xl font-semibold text-neutral-900">{history.length}</p>
            <p className="text-xs text-neutral-400">total scans</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">Successful</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{successCount}</p>
            <p className="text-xs text-neutral-400">new check-ins</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <p className="text-xs text-neutral-500">Duplicates</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{duplicateCount}</p>
            <p className="text-xs text-neutral-400">already checked in</p>
          </article>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,540px)_1fr]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ScanLine className="h-5 w-5 text-[var(--theme-accent)]" />
                  <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Scan or Enter Token</h2>
                </div>
                <Badge className={cameraActive ? "bg-emerald-100 text-emerald-700 border-transparent" : "bg-neutral-100 text-neutral-600 border-transparent"}>
                  {cameraActive ? "Camera Active" : "Manual"}
                </Badge>
              </div>

              {cameraActive && (
                <div className="relative mb-4 overflow-hidden rounded-xl border-2 border-[var(--theme-accent)] bg-black aspect-[3/4] w-full sm:aspect-[4/3]">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-[62%] w-[62%] rounded-xl border-2 border-white/75">
                      <div className="h-1 w-10 rounded-full bg-[var(--theme-accent)] animate-pulse" />
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                    aria-label="Stop camera"
                  >
                    <CameraOff className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="space-y-3">
                {cameraSupported && !cameraActive && (
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-2 text-sm sm:h-12"
                    onClick={startCamera}
                    disabled={loading}
                  >
                    <Camera className="h-4 w-4" />
                    Scan QR Code with Camera
                  </Button>
                )}

                {cameraSupported === false && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Camera QR scanning is not supported on this browser. Use manual token entry below.
                  </p>
                )}

                <div className="space-y-1.5">
                  <Label>Token / QR value</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleCheckin();
                      }}
                      placeholder="Paste or type ticket token..."
                      autoFocus={!cameraActive}
                      className="h-11 font-mono text-sm sm:h-12"
                    />
                    <Button
                      className="hidden h-11 sm:inline-flex sm:h-12 sm:px-5"
                      onClick={() => handleCheckin()}
                      disabled={loading || !token.trim()}
                    >
                      {loading ? "Checking..." : "Check In"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {result && (
              <section
                className={`rounded-2xl border p-4 shadow-sm sm:p-6 ${
                  !result.ok
                    ? "border-red-200 bg-red-50"
                    : result.data?.alreadyCheckedIn
                      ? "border-amber-200 bg-amber-50"
                      : "border-emerald-200 bg-emerald-50"
                }`}
              >
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
                        Ticket <span className="font-mono">{result.data.ticketNumber}</span> was checked in at{" "}
                        {formatDateTime(result.data.checkedInAt)}.
                      </p>
                      <p className="mt-0.5 text-sm text-amber-700">{result.data.eventTitle}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-emerald-900">Check-in Successful</p>
                      <p className="mt-1 text-sm text-emerald-700">
                        <span className="font-mono">{result.data?.ticketNumber}</span>
                        {result.data?.buyerName ? ` · ${result.data.buyerName}` : ""}
                      </p>
                      <p className="mt-0.5 text-sm text-emerald-700">{result.data?.eventTitle}</p>
                      {cameraSupported && (
                        <Button size="sm" variant="outline" className="mt-3 h-10 gap-1.5" onClick={startCamera}>
                          <Camera className="h-3.5 w-3.5" />
                          Scan next
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Session History</h2>
              {history.length > 0 && (
                <span className="rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent)]">
                  {history.length}
                </span>
              )}
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-neutral-400">No check-ins yet this session.</p>
            ) : (
              <div className="space-y-2 sm:max-h-[640px] sm:overflow-auto sm:pr-1">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 text-sm ${
                      entry.result.alreadyCheckedIn
                        ? "border-amber-100 bg-amber-50"
                        : "border-emerald-100 bg-emerald-50"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {entry.result.alreadyCheckedIn ? (
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs text-neutral-500">{entry.result.ticketNumber}</p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              entry.result.alreadyCheckedIn
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {entry.result.alreadyCheckedIn ? "Duplicate" : "OK"}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate font-medium text-neutral-900">{entry.result.eventTitle}</p>
                        {entry.result.buyerName && <p className="text-xs text-neutral-500">{entry.result.buyerName}</p>}
                        <p className="mt-0.5 text-xs text-neutral-400">{formatDateTime(entry.ts)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="h-20 sm:hidden" />
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-white/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          {cameraSupported && (
            <Button
              variant="outline"
              className="h-11 min-w-[108px]"
              onClick={cameraActive ? stopCamera : startCamera}
              disabled={loading}
            >
              {cameraActive ? "Stop Cam" : "Camera"}
            </Button>
          )}
          <Button className="h-11 flex-1" onClick={() => handleCheckin()} disabled={loading || !token.trim()}>
            {loading ? "Checking..." : "Check In"}
          </Button>
        </div>
      </div>
    </SidebarLayout>
  );
}
