import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, status?: number) {
  const responseStatus = status ?? 200;
  if (responseStatus < 200 || responseStatus > 599) {
    throw new RangeError(`init["status"] must be in the range of 200 to 599, inclusive.`);
  }
  return NextResponse.json({ success: true, data }, { status: responseStatus });
}

export function fail(status: number, error: ApiErrorPayload) {
  return NextResponse.json({ success: false, error }, { status });
}
