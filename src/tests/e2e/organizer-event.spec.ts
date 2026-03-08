import { expect, request as playwrightRequest, test } from "@playwright/test";

test("organizer creates event, adds ticket, and submits for approval", async ({ baseURL }) => {
  const email = `eventflow.${Date.now()}@eventsbox.local`;
  const password = "StrongPass123!";

  const organizer = await playwrightRequest.newContext({ baseURL });

  let res = await organizer.post("/api/auth/register", { data: { email, password } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/organizer/onboarding", {
    data: {
      companyName: "Flow Events",
      phone: "0123456789",
      contactName: "Flow Owner",
      taxId: "FLOW-TAX-1",
      addressLine1: "Flow Road 1",
      addressLine2: "Suite 3",
      submit: true,
    },
  });
  expect(res.ok()).toBeTruthy();

  const admin = await playwrightRequest.newContext({ baseURL });
  res = await admin.post("/api/auth/login", {
    data: { email: "admin@eventsbox.local", password: "Admin123!" },
  });
  expect(res.ok()).toBeTruthy();

  res = await admin.get("/api/admin/organizers");
  const organizers = (await res.json()).data as Array<{ id: string; user: { email: string } }>;
  const targetOrganizer = organizers.find((row) => row.user.email === email);
  expect(targetOrganizer).toBeTruthy();

  res = await admin.post(`/api/admin/organizers/${targetOrganizer!.id}/decision`, { data: { action: "APPROVED" } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/api/public/locations");
  const states = (await res.json()).data as Array<{ id: string; cities: Array<{ id: string }> }>;
  const stateId = states[0]?.id;
  const cityId = states[0]?.cities?.[0]?.id;
  expect(stateId).toBeTruthy();
  expect(cityId).toBeTruthy();

  res = await organizer.post("/api/organizer/venues", {
    data: {
      name: "Flow Venue",
      addressLine1: "Event Street",
      stateId,
      cityId,
      seatingConfig: {
        mapType: "seats",
        sections: [
          {
            id: "flow-sec-1",
            name: "Main",
            mapType: "seats",
            rowStart: 0,
            maxRows: 2,
            columns: [{ index: 1, rows: 2, seats: 4 }],
          },
        ],
        seatState: {},
        summary: { totalSeats: 8, totalTables: 0, sectionCount: 1 },
        schemaVersion: 1,
      },
      seatState: {},
      summary: { totalSeats: 8, totalTables: 0, sectionCount: 1 },
    },
  });
  expect(res.ok()).toBeTruthy();
  const venue = (await res.json()).data as { id: string };

  res = await admin.post(`/api/admin/venues/${venue.id}/decision`, { data: { action: "APPROVED" } });
  expect(res.ok()).toBeTruthy();

  const startAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const endAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString();

  res = await organizer.post("/api/organizer/events", {
    data: {
      title: `Flow Event ${Date.now()}`,
      description: "E2E organizer event flow",
      venueId: venue.id,
      stateId,
      cityId,
      startAt,
      endAt,
      timezone: "Asia/Dhaka",
    },
  });
  expect(res.ok()).toBeTruthy();
  const event = (await res.json()).data as { id: string; status: string };
  expect(event.status).toBe("DRAFT");

  res = await organizer.post(`/api/organizer/events/${event.id}/tickets`, {
    data: {
      name: "General",
      kind: "DIRECT",
      price: 25,
      quantity: 100,
      maxPerOrder: 10,
    },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post(`/api/organizer/events/${event.id}/submit`);
  expect(res.ok()).toBeTruthy();
  const submitted = (await res.json()).data as { status: string };
  expect(submitted.status).toBe("PENDING_APPROVAL");
});
