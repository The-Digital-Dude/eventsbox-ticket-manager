import { fail, ok } from "@/src/lib/http/response";
import { getServerSession } from "@/src/lib/auth/server-auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return fail(401, { code: "UNAUTHENTICATED", message: "Not authenticated" });
    }

    return ok({
      id: session.user.id,
      email: session.user.email,
      role: session.user.role,
    });
  } catch (error) {
    console.error("[app/api/auth/me/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to load session" });
  }
}
