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
  await expect(await res.text()).toContain("Phase 0/1 Access Enabled");

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

  res = await organizer.get("/api/organizer/venues");
  const myVenues = (await res.json()).data as Array<{ id: string; status: string }>;
  const approvedVenue = myVenues.find((v) => v.id === targetVenue!.id);
  expect(approvedVenue?.status).toBe("APPROVED");
});
