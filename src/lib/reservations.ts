import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/src/lib/env";

type ReservationPayload = {
  eventId: string;
  seatIds: string[];
  expiresAt: string;
};

function getReservationSecret() {
  return env.JWT_ACCESS_SECRET ?? env.STRIPE_WEBHOOK_SECRET ?? "eventsbox-local-reservation-secret";
}

function encode(input: string) {
  return Buffer.from(input).toString("base64url");
}

function decode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", getReservationSecret()).update(payload).digest("base64url");
}

export function createReservationToken(payload: ReservationPayload) {
  const body = encode(JSON.stringify({
    ...payload,
    seatIds: [...payload.seatIds].sort(),
  }));
  return `${body}.${sign(body)}`;
}

export function verifyReservationToken(token: string): ReservationPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(decode(body)) as ReservationPayload;
    if (!parsed.eventId || !Array.isArray(parsed.seatIds) || !parsed.expiresAt) {
      return null;
    }
    return {
      eventId: parsed.eventId,
      seatIds: [...parsed.seatIds].sort(),
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
