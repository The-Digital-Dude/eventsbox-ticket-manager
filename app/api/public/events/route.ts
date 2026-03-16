import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { ok } from "@/src/lib/http/response";

const DURATION_SHORT_MS = 3 * 60 * 60 * 1000;
const DURATION_HALF_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || undefined;
  const categoryId =
    req.nextUrl.searchParams.get("category") ||
    req.nextUrl.searchParams.get("categoryId") ||
    undefined;
  const stateId =
    req.nextUrl.searchParams.get("state") ||
    req.nextUrl.searchParams.get("stateId") ||
    undefined;
  const venueId = req.nextUrl.searchParams.get("venueId") || undefined;
  const cityId = req.nextUrl.searchParams.get("cityId") || undefined;
  const minPriceRaw = req.nextUrl.searchParams.get("minPrice");
  const maxPriceRaw = req.nextUrl.searchParams.get("maxPrice");
  const duration = req.nextUrl.searchParams.get("duration") || undefined;
  const from = req.nextUrl.searchParams.get("from")?.trim() || undefined;
  const to = req.nextUrl.searchParams.get("to")?.trim() || undefined;

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(`${to}T23:59:59Z`) : undefined;
  const hasValidFrom = Boolean(fromDate && !Number.isNaN(fromDate.getTime()));
  const hasValidTo = Boolean(toDate && !Number.isNaN(toDate.getTime()));

  const minPrice = minPriceRaw !== null && minPriceRaw !== "" ? parseFloat(minPriceRaw) : undefined;
  const maxPrice = maxPriceRaw !== null && maxPriceRaw !== "" ? parseFloat(maxPriceRaw) : undefined;
  const hasMinPrice = minPrice !== undefined && !Number.isNaN(minPrice);
  const hasMaxPrice = maxPrice !== undefined && !Number.isNaN(maxPrice);

  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      ...(categoryId ? { categoryId } : {}),
      ...(stateId ? { stateId } : {}),
      ...(venueId ? { venueId } : {}),
      ...(cityId ? { cityId } : {}),
      ...(hasValidFrom || hasValidTo
        ? {
            startAt: {
              ...(hasValidFrom ? { gte: fromDate } : {}),
              ...(hasValidTo ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(hasMinPrice || hasMaxPrice
        ? {
            ticketTypes: {
              some: {
                isActive: true,
                price: {
                  ...(hasMinPrice ? { gte: minPrice } : {}),
                  ...(hasMaxPrice ? { lte: maxPrice } : {}),
                },
              },
            },
          }
        : {}),
      ...(q ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      venue: { select: { id: true, name: true } },
      state: { select: { id: true, name: true } },
      city: { select: { id: true, name: true } },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: { id: true, name: true, price: true, quantity: true, sold: true, reservedQty: true },
      },
      organizerProfile: { select: { companyName: true, brandName: true } },
    },
    orderBy: { startAt: "asc" },
  });

  // Duration filter applied in JS (Prisma cannot compute endAt-startAt)
  const filtered =
    duration && duration !== "any"
      ? events.filter((e) => {
          const ms = e.endAt.getTime() - e.startAt.getTime();
          if (duration === "short") return ms < DURATION_SHORT_MS;
          if (duration === "half") return ms >= DURATION_SHORT_MS && ms < DURATION_HALF_MS;
          if (duration === "full") return ms >= DURATION_HALF_MS;
          return true;
        })
      : events;

  return ok(filtered);
}
