import { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/src/lib/http/response";
import { validatePromoCodeByCode } from "@/src/lib/services/promo-code";

const validatePromoSchema = z.object({
  code: z.string().trim().min(1),
  eventId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = validatePromoSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, {
        code: "VALIDATION_ERROR",
        message: "Invalid promo validation payload",
        details: parsed.error.flatten(),
      });
    }

    const result = await validatePromoCodeByCode({
      code: parsed.data.code,
      eventId: parsed.data.eventId,
    });

    if (!result.valid) {
      return ok({ valid: false, message: result.message });
    }

    return ok({
      valid: true,
      discountType: result.promoCode.discountType,
      discountValue: result.promoCode.discountValue,
      promoCodeId: result.promoCode.id,
    });
  } catch (error) {
    console.error("[app/api/checkout/validate-promo/route.ts]", error);
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to validate promo code" });
  }
}
