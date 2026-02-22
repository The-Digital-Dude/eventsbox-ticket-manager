import { cookies } from "next/headers";
import { ACCESS_TOKEN_COOKIE } from "@/src/lib/auth/constants";
import { verifyAccessToken } from "@/src/lib/auth/jwt";
import { prisma } from "@/src/lib/db";

export async function getServerSession() {
  const store = await cookies();
  const token = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return null;
    return { user };
  } catch {
    return null;
  }
}
