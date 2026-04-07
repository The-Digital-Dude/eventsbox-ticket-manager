import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { POST as attendeeRegisterPost } from "@/app/api/auth/register/attendee/route";
import { POST as loginPost } from "@/app/api/auth/login/route";
import { GET as accountOrdersGet } from "@/app/api/account/orders/route";
import { GET as accountProfileGet, PATCH as accountProfilePatch } from "@/app/api/account/profile/route";

async function registerAttendee(email: string, displayName = "Attendee") {
  const registerReq = new NextRequest("http://localhost/api/auth/register/attendee", {
    method: "POST",
    body: JSON.stringify({ email, password: "StrongPass123!", displayName }),
    headers: { "content-type": "application/json" },
  });

  return attendeeRegisterPost(registerReq);
}

async function loginAttendee(email: string) {
  const loginReq = new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "StrongPass123!" }),
    headers: { "content-type": "application/json" },
  });

  const loginRes = await loginPost(loginReq);
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const accessPair = setCookie.split(", ").find((cookie) => cookie.startsWith("eventsbox_access=")) ?? "";
  const accessCookie = accessPair.split(";")[0];

  return { loginRes, accessCookie };
}

describe("attendee account integration", () => {
  it(
    "POST /api/auth/register/attendee creates ATTENDEE user",
    async () => {
      const email = `attendee.${Date.now()}@eventsbox.local`;
      const registerRes = await registerAttendee(email);
      expect(registerRes.status).toBe(201);

      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.role).toBe(Role.ATTENDEE);
      expect(user?.id).toBeTruthy();
    },
    30_000,
  );

  it(
    "POST /api/auth/register/attendee rejects duplicate email",
    async () => {
      const email = `attendee.dup.${Date.now()}@eventsbox.local`;
      const first = await registerAttendee(email);
      expect(first.status).toBe(201);

      const second = await registerAttendee(email);
      expect(second.status).toBe(409);
    },
    30_000,
  );

  it(
    "POST /api/auth/login succeeds for ATTENDEE credentials",
    async () => {
      const email = `attendee.login.${Date.now()}@eventsbox.local`;
      const registerRes = await registerAttendee(email);
      expect(registerRes.status).toBe(201);

      const { loginRes } = await loginAttendee(email);
      expect(loginRes.status).toBe(200);

      const payload = (await loginRes.json()) as { data?: { user?: { role?: string } } };
      expect(payload.data?.user?.role).toBe("ATTENDEE");
    },
    30_000,
  );

  it("GET /api/account/orders returns 401 without auth", async () => {
    const req = new NextRequest("http://localhost/api/account/orders", { method: "GET" });
    const res = await accountOrdersGet(req);
    expect(res.status).toBe(401);
  });

  it(
    "GET /api/account/orders returns empty array for new attendee",
    async () => {
      const email = `attendee.orders.${Date.now()}@eventsbox.local`;
      const registerRes = await registerAttendee(email);
      expect(registerRes.status).toBe(201);

      const { accessCookie } = await loginAttendee(email);
      const req = new NextRequest("http://localhost/api/account/orders?page=1", {
        method: "GET",
        headers: { cookie: accessCookie },
      });

      const res = await accountOrdersGet(req);
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { data?: { orders?: unknown[] } };
      expect(payload.data?.orders).toEqual([]);
    },
    30_000,
  );

  it(
    "PATCH /api/account/profile updates attendee displayName",
    async () => {
      const email = `attendee.patch.${Date.now()}@eventsbox.local`;
      const registerRes = await registerAttendee(email, "Before Name");
      expect(registerRes.status).toBe(201);

      const { accessCookie } = await loginAttendee(email);
      const req = new NextRequest("http://localhost/api/account/profile", {
        method: "PATCH",
        body: JSON.stringify({ displayName: "After Name", phone: "+880100000000" }),
        headers: { "content-type": "application/json", cookie: accessCookie },
      });

      const res = await accountProfilePatch(req);
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { data?: { displayName?: string } };
      expect(payload.data?.displayName).toBe("After Name");
    },
    30_000,
  );

  it(
    "GET /api/account/profile returns attendee profile data",
    async () => {
      const email = `attendee.get.${Date.now()}@eventsbox.local`;
      const registerRes = await registerAttendee(email, "Profile Name");
      expect(registerRes.status).toBe(201);

      const { accessCookie } = await loginAttendee(email);
      const req = new NextRequest("http://localhost/api/account/profile", {
        method: "GET",
        headers: { cookie: accessCookie },
      });

      const res = await accountProfileGet(req);
      expect(res.status).toBe(200);
      const payload = (await res.json()) as { data?: { email?: string; displayName?: string | null } };
      expect(payload.data?.email).toBe(email);
      expect(payload.data?.displayName).toBe("Profile Name");
    },
    30_000,
  );
});
