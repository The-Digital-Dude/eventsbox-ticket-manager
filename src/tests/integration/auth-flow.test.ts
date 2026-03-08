import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as loginPost } from "@/app/api/auth/login/route";

describe("auth integration", () => {
  it(
    "registers and logs in organizer",
    async () => {
      const email = `organizer.${Date.now()}@eventsbox.local`;

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
      expect(loginRes.status).toBe(200);
      expect(loginRes.headers.get("set-cookie")).toContain("eventsbox_access");
    },
    15_000,
  );
});
