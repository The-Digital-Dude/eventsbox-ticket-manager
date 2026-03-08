import { PromoCode } from "@prisma/client";
import { prisma } from "@/src/lib/db";

type PromoValidationResult =
  | {
      valid: true;
      promoCode: PromoCode;
    }
  | {
      valid: false;
      message: string;
    };

function isExpired(expiresAt: Date | null) {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

export async function validatePromoCodeByCode(input: {
  code: string;
  eventId: string;
}): Promise<PromoValidationResult> {
  const promoCode = await prisma.promoCode.findFirst({
    where: { code: { equals: input.code.trim(), mode: "insensitive" } },
  });

  if (!promoCode) {
    return { valid: false, message: "Promo code not found" };
  }

  return validatePromoCodeRecord(promoCode, input.eventId);
}

export async function validatePromoCodeById(input: {
  promoCodeId: string;
  eventId: string;
}): Promise<PromoValidationResult> {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: input.promoCodeId },
  });

  if (!promoCode) {
    return { valid: false, message: "Promo code not found" };
  }

  return validatePromoCodeRecord(promoCode, input.eventId);
}

function validatePromoCodeRecord(promoCode: PromoCode, eventId: string): PromoValidationResult {
  if (!promoCode.isActive) {
    return { valid: false, message: "Promo code is inactive" };
  }

  if (isExpired(promoCode.expiresAt)) {
    return { valid: false, message: "Promo code has expired" };
  }

  if (promoCode.eventId && promoCode.eventId !== eventId) {
    return { valid: false, message: "Promo code is not valid for this event" };
  }

  if (promoCode.maxUses !== null && promoCode.usedCount >= promoCode.maxUses) {
    return { valid: false, message: "Promo code usage limit reached" };
  }

  return { valid: true, promoCode };
}
