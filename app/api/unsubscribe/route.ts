import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();

  if (!token) {
    return fail(400, { code: "INVALID_TOKEN", message: "A valid unsubscribe token is required" });
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true, email: true },
  });

  if (!user) {
    return fail(400, { code: "INVALID_TOKEN", message: "This unsubscribe link is invalid" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { marketingOptOut: true },
  });

  return ok({ unsubscribed: true, email: user.email });
}
