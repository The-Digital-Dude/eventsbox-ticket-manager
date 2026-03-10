"use client";

import { useDeferredValue, useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock3,
  ScanLine,
  Camera,
  CameraOff,
  ListChecks,
} from "lucide-react";
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
  { href: "/organizer/cancellation-requests", label: "Cancellations" },
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

type OrganizerEventOption = {
  id: string;
  title: string;
  status: string;
};

type AttendeeTicketRow = {
  ticketId: string;
  ticketNumber: string;
  ticketTypeName: string;
  buyerName: string;
  buyerEmail: string;
  seatLabel: string | null;
  checkedInAt: string | null;
  isComplimentary: boolean;
};

type AttendeeListSummary = {
  total: number;
  checkedIn: number;
  remaining: number;
};

declare class BarcodeDetector {
  static getSupportedFormats(): Promise<string[]>;
  constructor(options: { formats: string[] });
  detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>>;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScannerPage() {
  const [activeTab, setActiveTab] = useState<"scanner" | "attendees">("scanner");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; data?: CheckInResult; error?: string } | null>(
    null,
  );
  const [history, setHistory] = useState<Array<{ token: string; result: CheckInResult; ts: string }>>(
    [],
  );

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported, setCameraSupported] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const lastScannedRef = useRef<string>("");

  const [events, setEvents] = useState<OrganizerEventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [attendeeTickets, setAttendeeTickets] = useState<AttendeeTicketRow[]>([]);
  const [attendeeSummary, setAttendeeSummary] = useState<AttendeeListSummary>({
    total: 0,
    checkedIn: 0,
    remaining: 0,
  });
  const [attendeeListLoading, setAttendeeListLoading] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const deferredAttendeeSearch = useDeferredValue(attendeeSearch.trim().toLowerCase());
  const [attendeeStatusFilter, setAttendeeStatusFilter] = useState<"all" | "checkedIn" | "notYet">(
    "all",
  );
  const [manualCheckInTicketId, setManualCheckInTicketId] = useState<string | null>(null);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "BarcodeDetector" in window &&
      typeof navigator?.mediaDevices?.getUserMedia === "function";
    setCameraSupported(supported);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadOrganizerEvents() {
      setEventsLoading(true);

      try {
        const res = await fetch("/api/organizer/events?status=PUBLISHED", { cache: "no-store" });
        const payload = await res.json();
        if (!active) return;

        if (!res.ok) {
          toast.error(payload?.error?.message ?? "Unable to load published events");
          setEvents([]);
          return;
        }

        const rows = (payload?.data ?? []).map((event: OrganizerEventOption) => ({
          id: event.id,
          title: event.title,
          status: event.status,
        }));
        setEvents(rows);
        setSelectedEventId((current) => current || rows[0]?.id || "");
      } finally {
        if (active) {
          setEventsLoading(false);
        }
      }
    }

    void loadOrganizerEvents();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedEventId) {
      setAttendeeTickets([]);
      setAttendeeSummary({ total: 0, checkedIn: 0, remaining: 0 });
      setAttendeeListLoading(false);
      return;
    }

    let active = true;

    async function loadAttendeeList() {
      setAttendeeListLoading(true);
      try {
        const res = await fetch(`/api/organizer/events/${selectedEventId}/checkin-list`, {
          cache: "no-store",
        });
        const payload = await res.json();
        if (!active) return;

        if (!res.ok) {
          toast.error(payload?.error?.message ?? "Unable to load attendee list");
          setAttendeeTickets([]);
          setAttendeeSummary({ total: 0, checkedIn: 0, remaining: 0 });
          return;
        }

        setAttendeeTickets(payload.data.tickets ?? []);
        setAttendeeSummary(payload.data.summary ?? { total: 0, checkedIn: 0, remaining: 0 });
      } finally {
        if (active) {
          setAttendeeListLoading(false);
        }
      }
    }

    void loadAttendeeList();

    return () => {
      active = false;
    };
  }, [selectedEventId]);

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
    setHistory((prev) => [
      { token: value, result: data, ts: new Date().toISOString() },
      ...prev.slice(0, 19),
    ]);
    setToken("");
  }

  async function handleManualCheckIn(ticketId: string) {
    if (!selectedEventId) return;

    setManualCheckInTicketId(ticketId);
    const res = await fetch(`/api/organizer/events/${selectedEventId}/checkin-list`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticketId }),
    });
    const payload = await res.json();
    setManualCheckInTicketId(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to check in attendee");
      return;
    }

    const checkedInAt = payload.data.checkedInAt as string;
    const alreadyCheckedIn = payload.data.alreadyCheckedIn as boolean;
    setAttendeeTickets((current) =>
      current.map((ticket) =>
        ticket.ticketId === ticketId ? { ...ticket, checkedInAt } : ticket,
      ),
    );
    if (!alreadyCheckedIn) {
      setAttendeeSummary((current) => ({
        total: current.total,
        checkedIn: current.checkedIn + 1,
        remaining: Math.max(0, current.remaining - 1),
      }));
      toast.success("Attendee checked in");
    } else {
      toast.message(`Already checked in at ${formatDateTime(checkedInAt)}`);
    }
  }

  const filteredAttendeeTickets = attendeeTickets.filter((ticket) => {
    const matchesSearch =
      !deferredAttendeeSearch ||
      ticket.buyerName.toLowerCase().includes(deferredAttendeeSearch) ||
      ticket.buyerEmail.toLowerCase().includes(deferredAttendeeSearch);
    const matchesStatus =
      attendeeStatusFilter === "all" ||
      (attendeeStatusFilter === "checkedIn" ? Boolean(ticket.checkedInAt) : !ticket.checkedInAt);

    return matchesSearch && matchesStatus;
  });

  const successCount = history.filter((entry) => !entry.result.alreadyCheckedIn).length;
  const duplicateCount = history.filter((entry) => entry.result.alreadyCheckedIn).length;

  return (
    <SidebarLayout role="organizer" title="Organizer" items={nav}>
      <PageHeader
        title="Scanner & Check-In"
        subtitle="Scan QR codes quickly, or switch to the attendee list for manual check-in."
      />

      <div className="inline-flex rounded-2xl border border-[var(--border)] bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "scanner"
              ? "bg-[var(--theme-accent)] text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          QR Scanner
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("attendees")}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "attendees"
              ? "bg-[var(--theme-accent)] text-white"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Attendee List
        </button>
      </div>

      {activeTab === "scanner" ? (
        <>
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
                    <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">
                      Scan or Enter Token
                    </h2>
                  </div>
                  <Badge
                    className={
                      cameraActive
                        ? "border-transparent bg-emerald-100 text-emerald-700"
                        : "border-transparent bg-neutral-100 text-neutral-600"
                    }
                  >
                    {cameraActive ? "Camera Active" : "Manual"}
                  </Badge>
                </div>

                {cameraActive ? (
                  <div className="relative mb-4 aspect-[3/4] w-full overflow-hidden rounded-xl border-2 border-[var(--theme-accent)] bg-black sm:aspect-[4/3]">
                    <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[62%] w-[62%] rounded-xl border-2 border-white/75">
                        <div className="h-1 w-10 animate-pulse rounded-full bg-[var(--theme-accent)]" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                      aria-label="Stop camera"
                    >
                      <CameraOff className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}

                <div className="space-y-3">
                  {cameraSupported && !cameraActive ? (
                    <Button
                      variant="outline"
                      className="h-11 w-full gap-2 text-sm sm:h-12"
                      onClick={startCamera}
                      disabled={loading}
                    >
                      <Camera className="h-4 w-4" />
                      Scan QR Code with Camera
                    </Button>
                  ) : null}

                  {cameraSupported === false ? (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      Camera QR scanning is not supported on this browser. Use manual token entry below.
                    </p>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label>Token / QR value</Label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input
                        value={token}
                        onChange={(event) => setToken(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void handleCheckin();
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

              {result ? (
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
                        {cameraSupported ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 h-10 gap-1.5"
                            onClick={startCamera}
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Scan next
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>
              ) : null}
            </div>

            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-neutral-900 sm:text-lg">Session History</h2>
                {history.length > 0 ? (
                  <span className="rounded-full bg-[rgb(var(--theme-accent-rgb)/0.1)] px-2.5 py-0.5 text-xs font-semibold text-[var(--theme-accent)]">
                    {history.length}
                  </span>
                ) : null}
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-neutral-400">No check-ins yet this session.</p>
              ) : (
                <div className="space-y-2 sm:max-h-[640px] sm:overflow-auto sm:pr-1">
                  {history.map((entry, index) => (
                    <div
                      key={index}
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
                            <p className="font-mono text-xs text-neutral-500">
                              {entry.result.ticketNumber}
                            </p>
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
                          <p className="mt-0.5 truncate font-medium text-neutral-900">
                            {entry.result.eventTitle}
                          </p>
                          {entry.result.buyerName ? (
                            <p className="text-xs text-neutral-500">{entry.result.buyerName}</p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-neutral-400">{formatDateTime(entry.ts)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="h-20 sm:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-white/95 p-3 backdrop-blur sm:hidden">
            <div className="mx-auto flex max-w-md gap-2">
              {cameraSupported ? (
                <Button
                  variant="outline"
                  className="h-11 min-w-[108px]"
                  onClick={cameraActive ? stopCamera : startCamera}
                  disabled={loading}
                >
                  {cameraActive ? "Stop Cam" : "Camera"}
                </Button>
              ) : null}
              <Button
                className="h-11 flex-1"
                onClick={() => handleCheckin()}
                disabled={loading || !token.trim()}
              >
                {loading ? "Checking..." : "Check In"}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-[minmax(220px,320px)_1fr]">
              <div className="space-y-2">
                <Label htmlFor="scannerEventId">Event</Label>
                <select
                  id="scannerEventId"
                  className="app-select"
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  disabled={eventsLoading}
                >
                  {events.length === 0 ? (
                    <option value="">No published events</option>
                  ) : null}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-500">Checked In</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-700">
                    {attendeeSummary.checkedIn}
                  </p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-500">Total Tickets</p>
                  <p className="mt-1 text-2xl font-semibold text-neutral-900">{attendeeSummary.total}</p>
                </article>
                <article className="rounded-2xl border border-[var(--border)] bg-neutral-50 p-4">
                  <p className="text-xs text-neutral-500">Remaining</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-700">
                    {attendeeSummary.remaining}
                  </p>
                </article>
              </div>
            </div>

            <p className="mt-4 text-sm text-neutral-600">
              {attendeeSummary.checkedIn} / {attendeeSummary.total} checked in
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 flex-col gap-4 md:flex-row">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="attendeeSearch">Search</Label>
                  <Input
                    id="attendeeSearch"
                    value={attendeeSearch}
                    onChange={(event) => setAttendeeSearch(event.target.value)}
                    placeholder="Search by attendee name or email"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { id: "all", label: "All" },
                  { id: "checkedIn", label: "Checked In" },
                  { id: "notYet", label: "Not Yet" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() =>
                      setAttendeeStatusFilter(filter.id as "all" | "checkedIn" | "notYet")
                    }
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      attendeeStatusFilter === filter.id
                        ? "bg-[var(--theme-accent)] text-white"
                        : "border border-[var(--border)] bg-white text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              {attendeeListLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
                  ))}
                </div>
              ) : filteredAttendeeTickets.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
                  <ListChecks className="mx-auto h-8 w-8 text-neutral-300" />
                  <p className="mt-3 text-sm text-neutral-500">
                    {selectedEventId
                      ? "No attendees match the current filters."
                      : "Select an event to load the attendee list."}
                  </p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border)] bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                    <tr>
                      <th className="px-4 py-3">Ticket #</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Seat</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredAttendeeTickets.map((ticket) => (
                      <tr key={ticket.ticketId}>
                        <td className="px-4 py-3 font-mono text-xs text-neutral-600">
                          {ticket.ticketNumber}
                        </td>
                        <td className="px-4 py-3 font-medium text-neutral-900">{ticket.buyerName}</td>
                        <td className="px-4 py-3 text-neutral-600">{ticket.buyerEmail}</td>
                        <td className="px-4 py-3 text-neutral-600">
                          <div className="flex flex-wrap gap-2">
                            <span>{ticket.ticketTypeName}</span>
                            {ticket.isComplimentary ? (
                              <Badge className="border-transparent bg-sky-100 text-sky-700">
                                Comp
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{ticket.seatLabel ?? "—"}</td>
                        <td className="px-4 py-3">
                          {ticket.checkedInAt ? (
                            <Badge className="border-transparent bg-emerald-100 text-emerald-700">
                              Checked In {formatDateTime(ticket.checkedInAt)}
                            </Badge>
                          ) : (
                            <span className="text-neutral-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ticket.checkedInAt ? (
                            <span className="text-xs text-neutral-400">Checked in</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleManualCheckIn(ticket.ticketId)}
                              disabled={manualCheckInTicketId === ticket.ticketId}
                            >
                              {manualCheckInTicketId === ticket.ticketId ? "Checking..." : "Check In"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}
    </SidebarLayout>
  );
}
