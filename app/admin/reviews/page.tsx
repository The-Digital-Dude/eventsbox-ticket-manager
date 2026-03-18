"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SidebarLayout } from "@/src/components/shared/sidebar-layout";
import { PageHeader } from "@/src/components/shared/page-header";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/organizers", label: "Organizers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/venues", label: "Venues" },
  { href: "/admin/payouts", label: "Payouts" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/audit", label: "Audit Log" },
  { href: "/admin/config", label: "Platform Config" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/locations", label: "Locations" },
];

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  isVisible: boolean;
  createdAt: string;
  attendeeName: string;
  eventId: string;
  event: {
    title: string;
    slug: string;
  };
};

type ReviewsPayload = {
  reviews: ReviewRow[];
  page: number;
  pages: number;
  total: number;
};

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function load(nextPage = page, nextQuery = q, nextVisibility = visibility) {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(nextPage),
    });

    if (nextQuery.trim()) {
      params.set("q", nextQuery.trim());
    }

    if (nextVisibility === "visible") {
      params.set("isVisible", "true");
    } else if (nextVisibility === "hidden") {
      params.set("isVisible", "false");
    }

    const res = await fetch(`/api/admin/reviews?${params.toString()}`, { cache: "no-store" });
    const payload = await res.json();
    setLoading(false);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to load reviews");
      return;
    }

    const data = payload.data as ReviewsPayload;
    setReviews(data.reviews);
    setPage(data.page);
    setPages(data.pages);
    setTotal(data.total);
  }

  useEffect(() => {
    void load(1, q, visibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, visibility]);

  async function toggleVisibility(review: ReviewRow) {
    setPendingId(review.id);
    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !review.isVisible }),
    });
    const payload = await res.json();
    setPendingId(null);

    if (!res.ok) {
      toast.error(payload?.error?.message ?? "Unable to update review");
      return;
    }

    toast.success(review.isVisible ? "Review hidden" : "Review shown");
    await load(page, q, visibility);
  }

  return (
    <SidebarLayout role="admin" title="Admin" items={nav}>
      <PageHeader title="Review Moderation" subtitle="Manage public review visibility across all events." />

      <section className="grid gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px]">
        <Input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search event, comment, or attendee..."
        />
        <select className="app-select" value={visibility} onChange={(event) => setVisibility(event.target.value)}>
          <option value="all">All visibility</option>
          <option value="visible">Visible only</option>
          <option value="hidden">Hidden only</option>
        </select>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">Reviews</h2>
            <p className="text-sm text-neutral-500">{total} total review{total === 1 ? "" : "s"}</p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 px-6 py-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="px-6 py-8 text-sm text-neutral-500">No reviews found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Attendee</th>
                  <th className="px-4 py-3">Comment</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {reviews.map((review) => (
                  <tr key={review.id}>
                    <td className="px-4 py-3 font-medium text-neutral-900">{review.event.title}</td>
                    <td className="px-4 py-3 text-neutral-700">{review.rating}/5</td>
                    <td className="px-4 py-3 text-neutral-700">{review.attendeeName}</td>
                    <td className="px-4 py-3 text-neutral-600">
                      {review.comment ? <span className="line-clamp-3 whitespace-pre-wrap">{review.comment}</span> : "No comment"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
                      {new Date(review.createdAt).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={review.isVisible ? "border-transparent bg-emerald-100 text-emerald-700" : "border-transparent bg-amber-100 text-amber-700"}>
                          {review.isVisible ? "Visible" : "Hidden"}
                        </Badge>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void toggleVisibility(review)}
                          disabled={pendingId === review.id}
                        >
                          {pendingId === review.id ? "Saving..." : review.isVisible ? "Hide" : "Show"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(page - 1, q, visibility)}
          disabled={page <= 1 || loading}
        >
          Previous
        </Button>
        <p className="text-sm text-neutral-500">Page {page} of {pages}</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => void load(page + 1, q, visibility)}
          disabled={page >= pages || loading}
        >
          Next
        </Button>
      </div>
    </SidebarLayout>
  );
}
