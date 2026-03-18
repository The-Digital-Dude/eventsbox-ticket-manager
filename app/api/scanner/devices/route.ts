import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/db";
import { fail, ok } from "@/src/lib/http/response";
import { getScannerAccess, scannerAccessErrorResponse } from "@/src/lib/scanner-access";

const createDeviceSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const access = await getScannerAccess(req);
    const parsed = createDeviceSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid scanner device payload",
        details: parsed.error.flatten(),
      });
    }

    const device = await prisma.scannerDevice.upsert({
      where: { deviceId: parsed.data.deviceId },
      update: {
        name: parsed.data.name,
      },
      create: {
        deviceId: parsed.data.deviceId,
        name: parsed.data.name,
        userId: access.payload.sub,
      },
    });

    return ok(device, 201);
  } catch (error) {
    const authResponse = scannerAccessErrorResponse(error);
    if (authResponse) return authResponse;

    console.error("[app/api/scanner/devices/route.ts][POST]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to register scanner device" });
  }
}
