import { NextRequest } from "next/server";
import { Role, StripeOnboardingStatus } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { getStripeClient } from "@/src/lib/stripe/client";
import { fail, ok } from "@/src/lib/http/response";
import { requireRole } from "@/src/lib/auth/guards";
import { payoutSchema } from "@/src/lib/validators/organizer";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    let settings = await prisma.organizerPayoutSettings.findUnique({ where: { organizerProfileId: profile.id } });

    if (settings?.stripeAccountId) {
      const stripe = getStripeClient();
      if (stripe) {
        try {
          const account = await stripe.accounts.retrieve(settings.stripeAccountId);
          const liveStripeStatus =
            "deleted" in account && account.deleted
              ? StripeOnboardingStatus.NOT_STARTED
              : account.details_submitted || (account.charges_enabled && account.payouts_enabled)
                ? StripeOnboardingStatus.COMPLETED
                : StripeOnboardingStatus.PENDING;

          if (settings.stripeOnboardingStatus !== liveStripeStatus) {
            settings = await prisma.organizerPayoutSettings.update({
              where: { id: settings.id },
              data: {
                stripeOnboardingStatus: liveStripeStatus,
              },
            });
          }
        } catch (error) {
          console.error("Unable to sync Stripe payout status:", error);
        }
      }
    }

    return ok(settings);
  } catch {
    return fail(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, Role.ORGANIZER);
    const parsed = payoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return fail(400, { code: "VALIDATION_ERROR", message: "Invalid payout settings", details: parsed.error.flatten() });
    }

    const profile = await prisma.organizerProfile.findUnique({ where: { userId: auth.sub } });
    if (!profile) {
      return fail(404, { code: "PROFILE_NOT_FOUND", message: "Organizer profile missing" });
    }

    const row = await prisma.organizerPayoutSettings.upsert({
      where: { organizerProfileId: profile.id },
      update: {
        payoutMode: parsed.data.payoutMode,
        manualPayoutNote: parsed.data.manualPayoutNote,
      },
      create: {
        organizerProfileId: profile.id,
        payoutMode: parsed.data.payoutMode,
        manualPayoutNote: parsed.data.manualPayoutNote,
      },
    });

    return ok(row);
  } catch {
    return fail(500, { code: "INTERNAL_ERROR", message: "Unable to update payout settings" });
  }
}
