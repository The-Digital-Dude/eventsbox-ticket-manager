import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { POST as venueCreatePost } from "@/app/api/organizer/venues/route";
import { PUT as venueUpdatePut } from "@/app/api/organizer/venues/[id]/route";
import { prisma } from "@/src/lib/db";

const baseSeating = {
  mapType: "seats",
  sections: [
    {
      id: "sec-1",
      name: "Main",
      mapType: "seats",
      rowStart: 0,
      maxRows: 2,
      columns: [{ index: 1, rows: 2, seats: 3 }],
    },
  ],
  seatState: { "Main-A1": { selected: true } },
  summary: { totalSeats: 6, totalTables: 0, sectionCount: 1 },
  schemaVersion: 1,
};

describe("venue seating integration", () => {
  it("creates and updates venue seating payload", async () => {
    const email = `venue.${Date.now()}@eventsbox.local`;

    const registerReq = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password: "StrongPass123!" }),
      headers: { "content-type": "application/json" },
    });
    const registerRes = await registerPost(registerReq);
    expect(registerRes.status).toBe(201);

    const loginReq = new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: "StrongPass123!" }),
      headers: { "content-type": "application/json" },
    });
    const loginRes = await loginPost(loginReq);
    const setCookie = loginRes.headers.get("set-cookie") ?? "";
    const accessPair = setCookie.split(", ").find((cookie) => cookie.startsWith("eventsbox_access=")) ?? "";
    const accessCookie = accessPair.split(";")[0];

    const state = await prisma.state.findFirst({ include: { cities: true } });
    const stateId = state?.id ?? "";
    const cityId = state?.cities?.[0]?.id ?? "";

    const createReq = new NextRequest("http://localhost/api/organizer/venues", {
      method: "POST",
      body: JSON.stringify({
        name: "Integration Hall",
        addressLine1: "Road 10",
        stateId,
        cityId,
        seatingConfig: baseSeating,
        seatState: baseSeating.seatState,
        summary: baseSeating.summary,
      }),
      headers: { "content-type": "application/json", cookie: accessCookie },
    });

    const createRes = await venueCreatePost(createReq);
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).data as { id: string; totalSeats: number };
    expect(created.totalSeats).toBe(6);

    const updateReq = new NextRequest(`http://localhost/api/organizer/venues/${created.id}`, {
      method: "PUT",
      body: JSON.stringify({
        seatingConfig: {
          ...baseSeating,
          sections: [
            {
              ...baseSeating.sections[0],
              columns: [{ index: 1, rows: 2, seats: 4 }],
            },
          ],
          summary: { totalSeats: 8, totalTables: 0, sectionCount: 1 },
        },
        seatState: {},
        summary: { totalSeats: 8, totalTables: 0, sectionCount: 1 },
      }),
      headers: { "content-type": "application/json", cookie: accessCookie },
    });

    const updateRes = await venueUpdatePut(updateReq, { params: Promise.resolve({ id: created.id }) });
    expect(updateRes.status).toBe(200);

    const venueInDb = await prisma.venue.findUnique({ where: { id: created.id } });
    expect(venueInDb?.totalSeats).toBe(8);
  });
});
