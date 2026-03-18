import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getScannerAccess, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

const updateDeviceSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ deviceId: string }> },
) {
  try {
    const access = await getScannerAccess(req);
    const parsed = updateDeviceSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid scanner device payload",
        details: parsed.error.flatten(),
      });
    }

    const { deviceId } = await params;
    const device = await prisma.scannerDevice.findUnique({
      where: { deviceId },
      select: {
        deviceId: true,
        userId: true,
        user: {
          select: {
            scannerProfile: {
              select: {
                organizerProfileId: true,
              },
            },
          },
        },
      },
    });

    if (!device) {
      return fail(404, { code: "NOT_FOUND", message: "Device not found" });
    }

    const ownsDevice = device.userId === access.payload.sub;
    const organizerCanManage =
      access.accessRole === Role.ORGANIZER &&
      device.user.scannerProfile?.organizerProfileId === access.organizerProfileId;

    if (!ownsDevice && !organizerCanManage) {
      return fail(403, { code: "FORBIDDEN", message: "You do not have access to this device" });
    }

    const updated = await prisma.scannerDevice.update({
      where: { deviceId },
      data: {
        name: parsed.data.name,
      },
    });

    return ok(updated);
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/devices/[deviceId]/route.ts][PATCH]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update scanner device" });
  }
}
