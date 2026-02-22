import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";

export async function writeAuditLog(input: {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
