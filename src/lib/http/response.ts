import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(status: number, error: ApiErrorPayload) {
  return NextResponse.json({ success: false, error }, { status });
}
