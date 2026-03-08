import { expect, request as playwrightRequest, test } from "@playwright/test";

test("organizer onboarding + admin approval + venue approval", async ({ baseURL }) => {
  const email = `smoke.${Date.now()}@eventsbox.local`;
  const password = "StrongPass123!";

  const organizer = await playwrightRequest.newContext({ baseURL });

  let res = await organizer.post("/api/auth/register", { data: { email, password } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/organizer/onboarding", {
    data: {
      companyName: "Smoke Events",
      phone: "0123456789",
      contactName: "Smoke Tester",
      taxId: "TX-123",
      addressLine1: "Road 1",
      addressLine2: "Suite 2",
      submit: false,
    },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/organizer/onboarding", {
    data: {
      companyName: "Smoke Events",
      phone: "0123456789",
      contactName: "Smoke Tester",
      taxId: "TX-123",
      addressLine1: "Road 1",
      addressLine2: "Suite 2",
      submit: true,
    },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/api/organizer/status");
  const statusPayload = await res.json();
  expect(statusPayload.data.status).toBe("PENDING_APPROVAL");

  const admin = await playwrightRequest.newContext({ baseURL });
  res = await admin.post("/api/auth/login", {
    data: { email: "admin@eventsbox.local", password: "Admin123!" },
  });
  expect(res.ok()).toBeTruthy();

  res = await admin.get("/api/admin/organizers");
  const organizers = (await res.json()).data as Array<{ id: string; user: { email: string } }>;
  const targetOrg = organizers.find((o) => o.user.email === email);
  expect(targetOrg).toBeTruthy();

  res = await admin.post(`/api/admin/organizers/${targetOrg!.id}/decision`, {
    data: { action: "APPROVED" },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/organizer/dashboard");
  expect(res.ok()).toBeTruthy();
  await expect(await res.text()).toContain("Organizer tools are now active");

  res = await organizer.get("/api/public/locations");
  const locations = (await res.json()).data as Array<{ id: string; cities: Array<{ id: string }> }>;
  const stateId = locations[0].id;
  const cityId = locations[0].cities[0].id;

  res = await organizer.post("/api/organizer/venues", {
    data: {
      name: "Smoke Venue",
      addressLine1: "Venue Street",
      stateId,
      cityId,
      seatingConfig: {
        mapType: "seats",
        sections: [
          {
            id: "smoke-sec-1",
            name: "Smoke Section",
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

  res = await admin.get("/api/admin/venues");
  const venues = (await res.json()).data as Array<{ id: string; name: string; organizerProfile: { user: { email: string } } }>;
  const targetVenue = venues.find((v) => v.name === "Smoke Venue" && v.organizerProfile.user.email === email);
  expect(targetVenue).toBeTruthy();

  res = await admin.post(`/api/admin/venues/${targetVenue!.id}/decision`, {
    data: { action: "APPROVED" },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.put(`/api/organizer/venues/${targetVenue!.id}`, {
    data: {
      seatingConfig: {
        mapType: "seats",
        sections: [
          {
            id: "smoke-sec-1",
            name: "Smoke Section",
            mapType: "seats",
            rowStart: 0,
            maxRows: 2,
            columns: [{ index: 1, rows: 2, seats: 5 }],
          },
        ],
        seatState: {},
        summary: { totalSeats: 10, totalTables: 0, sectionCount: 1 },
        schemaVersion: 1,
      },
      seatState: {},
      summary: { totalSeats: 10, totalTables: 0, sectionCount: 1 },
    },
  });
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/api/organizer/venues");
  const myVenues = (await res.json()).data as Array<{ id: string; status: string; totalSeats: number }>;
  const approvedVenue = myVenues.find((v) => v.id === targetVenue!.id);
  expect(approvedVenue?.status).toBe("APPROVED");
  expect(approvedVenue?.totalSeats).toBe(10);
});
