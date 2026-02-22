import { describe, expect, it } from "vitest";
import { rateLimit } from "@/src/lib/http/rate-limit";

describe("rateLimit", () => {
  it("limits after threshold", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 2; i += 1) {
      expect(rateLimit(key, 2, 1000).limited).toBe(false);
    }
    expect(rateLimit(key, 2, 1000).limited).toBe(true);
  });
});
