import { describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/src/lib/auth/jwt";

describe("jwt", () => {
  it("signs and verifies access token", () => {
    const token = signAccessToken({ sub: "u1", role: "ORGANIZER", email: "a@b.com" });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("u1");
    expect(payload.role).toBe("ORGANIZER");
  });
});
