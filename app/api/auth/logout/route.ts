import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/src/lib/auth/session";
import { requireAuth } from "@/src/lib/auth/guards";

export async function POST(req: NextRequest) {
  try {
    const payload = await requireAuth(req);
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    await destroySession(response, payload.sub);
    return response;
  } catch {
    const response = NextResponse.json({ success: true, data: { loggedOut: true } });
    await destroySession(response);
    return response;
  }
}
