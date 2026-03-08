import { getServerSession } from "@/src/lib/auth/server-auth";

export async function requireAttendee() {
  const session = await getServerSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.user.role !== "ATTENDEE") throw new Error("FORBIDDEN");
  return session;
}
