import { expect, request as playwrightRequest, test } from "@playwright/test";

test("registers, verifies email, logs in, and logs out", async ({ baseURL }) => {
  const email = `auth.${Date.now()}@eventsbox.local`;
  const password = "StrongPass123!";

  const organizer = await playwrightRequest.newContext({ baseURL });

  let res = await organizer.post("/api/auth/register", { data: { email, password } });
  expect(res.ok()).toBeTruthy();
  const registerPayload = await res.json();
  const token = registerPayload?.data?.verifyTokenDev as string;
  expect(token).toBeTruthy();

  res = await organizer.post("/api/auth/verify-email", { data: { token } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/auth/login", { data: { email, password } });
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/api/organizer/status");
  expect(res.ok()).toBeTruthy();

  res = await organizer.post("/api/auth/logout");
  expect(res.ok()).toBeTruthy();

  res = await organizer.get("/api/organizer/status");
  expect(res.status()).toBe(401);
});
