/**
 * One-shot demo setup script.
 * Creates: admin, organizer (jubayerjuhan.info@gmail.com), venue, event, ticket types.
 * Safe to re-run — all upserts.
 */
import {
  PrismaClient,
  PayoutMode,
  Role,
  OrganizerApprovalStatus,
  StripeOnboardingStatus,
  EventStatus,
  DiscountType,
  VenueStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting demo setup...");

  // ── PlatformConfig ──────────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      defaultCommissionPct: 8.5,
      defaultGstPct: 15,
      payoutModeDefault: PayoutMode.MANUAL,
    },
  });
  console.log("✅ Platform config");

  // ── Admin ───────────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin123!", 10);
  await prisma.user.upsert({
    where: { email: "admin@eventsbox.local" },
    update: { passwordHash: adminHash, emailVerified: true },
    create: {
      email: "admin@eventsbox.local",
      passwordHash: adminHash,
      role: Role.SUPER_ADMIN,
      emailVerified: true,
    },
  });
  console.log("✅ Admin: admin@eventsbox.local / Admin123!");

  // ── Categories ──────────────────────────────────────────────────────────
  const categoryNames = ["Concert", "Sports", "Conference", "Workshop", "Festival", "Comedy"];
  const categoryMap: Record<string, string> = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    categoryMap[name] = cat.id;
  }
  console.log("✅ Categories");

  // ── Countries / States / Cities ─────────────────────────────────────────
  const bd = await prisma.country.upsert({ where: { code: "BD" }, update: {}, create: { code: "BD", name: "Bangladesh" } });
  await prisma.country.upsert({ where: { code: "US" }, update: {}, create: { code: "US", name: "United States" } });
  await prisma.country.upsert({ where: { code: "GB" }, update: {}, create: { code: "GB", name: "United Kingdom" } });
  await prisma.country.upsert({ where: { code: "AU" }, update: {}, create: { code: "AU", name: "Australia" } });
  await prisma.country.upsert({ where: { code: "NZ" }, update: {}, create: { code: "NZ", name: "New Zealand" } });

  const dhaka = await prisma.state.upsert({
    where: { code: "BD-DHA" },
    update: { name: "Dhaka", countryId: bd.id },
    create: { code: "BD-DHA", name: "Dhaka", countryId: bd.id },
  });
  const dhakaCity = await prisma.city.upsert({
    where: { stateId_name: { stateId: dhaka.id, name: "Dhaka" } },
    update: {},
    create: { name: "Dhaka", stateId: dhaka.id },
  });
  console.log("✅ Locations");

  // ── Organizer: jubayerjuhan.info@gmail.com ──────────────────────────────
  const orgHash = await bcrypt.hash("Iamjuhan123", 10);
  const orgUser = await prisma.user.upsert({
    where: { email: "jubayerjuhan.info@gmail.com" },
    update: { passwordHash: orgHash, emailVerified: true, role: Role.ORGANIZER },
    create: {
      email: "jubayerjuhan.info@gmail.com",
      passwordHash: orgHash,
      role: Role.ORGANIZER,
      emailVerified: true,
    },
  });

  const orgProfile = await prisma.organizerProfile.upsert({
    where: { userId: orgUser.id },
    update: {
      brandName: "Jubayer Events",
      approvalStatus: OrganizerApprovalStatus.APPROVED,
    },
    create: {
      userId: orgUser.id,
      brandName: "Jubayer Events",
      companyName: "Jubayer Events Ltd.",
      contactName: "Jubayer Juhan",
      supportEmail: "jubayerjuhan.info@gmail.com",
      phone: "+8801700000000",
      approvalStatus: OrganizerApprovalStatus.APPROVED,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
    },
  });

  await prisma.organizerPayoutSettings.upsert({
    where: { organizerProfileId: orgProfile.id },
    update: {},
    create: {
      organizerProfileId: orgProfile.id,
      stripeOnboardingStatus: StripeOnboardingStatus.NOT_STARTED,
    },
  });
  console.log("✅ Organizer: jubayerjuhan.info@gmail.com / Iamjuhan123");

  // ── Venue with seating config (JSON) ───────────────────────────────────
  const seatingConfig = {
    sections: [
      {
        id: "front-stage",
        name: "Front Stage",
        rows: ["A", "B", "C", "D", "E"],
        seatsPerRow: 20,
        priceCategory: "VIP",
      },
      {
        id: "main-floor",
        name: "Main Floor",
        rows: ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R"],
        seatsPerRow: 20,
        priceCategory: "Standard",
      },
      {
        id: "balcony",
        name: "Balcony",
        rows: ["S", "T", "U", "V", "W", "X", "Y", "Z"],
        seatsPerRow: 15,
        priceCategory: "Budget",
      },
    ],
    totalSeats: 500,
  };

  const venue = await prisma.venue.upsert({
    where: { id: "juhan-venue-001" },
    update: { seatingConfig, seatingSchemaVersion: 1, totalSeats: 500 },
    create: {
      id: "juhan-venue-001",
      organizerProfileId: orgProfile.id,
      name: "The Dhaka Grand Amphitheatre",
      addressLine1: "Plot 2, Road 7, Gulshan 1, Dhaka 1212",
      totalSeats: 500,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      lat: 23.7945,
      lng: 90.4142,
      seatingConfig,
      seatingSchemaVersion: 1,
      status: VenueStatus.APPROVED,
    },
  });

  console.log("✅ Venue: The Dhaka Grand Amphitheatre (500 seats, 3 sections)");

  // ── Featured Event ──────────────────────────────────────────────────────
  const now = new Date();
  const startAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
  const endAt = new Date(startAt.getTime() + 4 * 60 * 60 * 1000);   // 4 hours long

  const event = await prisma.event.upsert({
    where: { slug: "jubayer-events-grand-opening-2026" },
    update: { startAt, endAt },
    create: {
      organizerProfileId: orgProfile.id,
      categoryId: categoryMap["Concert"],
      venueId: venue.id,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      title: "Jubayer Events Grand Opening Night 2026",
      slug: "jubayer-events-grand-opening-2026",
      description:
        "Join us for an unforgettable grand opening night featuring live performances, art installations, and exclusive networking opportunities. This is the event of the year in Dhaka — don't miss out.\n\nFeaturing: Live bands, guest DJs, catered dining, and a midnight fireworks display.",
      contactEmail: "jubayerjuhan.info@gmail.com",
      startAt,
      endAt,
      timezone: "Asia/Dhaka",
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      commissionPct: 8.5,
      gstPct: 15,
      isFeatured: true,
      tags: ["music", "networking", "grand-opening"],
    },
  });

  // ── Ticket Types ────────────────────────────────────────────────────────
  await prisma.ticketType.upsert({
    where: { id: "juhan-tt-general" },
    update: {},
    create: {
      id: "juhan-tt-general",
      eventId: event.id,
      name: "General Admission",
      price: 1200,
      quantity: 300,
      sold: 0,
      sortOrder: 1,
    },
  });

  await prisma.ticketType.upsert({
    where: { id: "juhan-tt-vip" },
    update: {},
    create: {
      id: "juhan-tt-vip",
      eventId: event.id,
      name: "VIP — Front Stage",
      price: 3500,
      quantity: 100,
      sold: 0,
      sortOrder: 2,
    },
  });

  await prisma.ticketType.upsert({
    where: { id: "juhan-tt-balcony" },
    update: {},
    create: {
      id: "juhan-tt-balcony",
      eventId: event.id,
      name: "Balcony View",
      price: 800,
      quantity: 100,
      sold: 0,
      sortOrder: 3,
    },
  });

  // ── Promo code ──────────────────────────────────────────────────────────
  await prisma.promoCode.upsert({
    where: { code: "JUHAN20" },
    update: {},
    create: {
      organizerProfileId: orgProfile.id,
      eventId: event.id,
      code: "JUHAN20",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      maxUses: 100,
      usedCount: 0,
      isActive: true,
    },
  });

  console.log("✅ Event: Jubayer Events Grand Opening Night 2026");
  console.log("✅ Ticket types: General (৳1200), VIP (৳3500), Balcony (৳800)");
  console.log("✅ Promo code: JUHAN20 (20% off)");

  // ── Demo organizer (simple login) ──────────────────────────────────────
  const demoHash = await bcrypt.hash("Demo123!", 10);
  const demoOrgUser = await prisma.user.upsert({
    where: { email: "organizer@demo.local" },
    update: { passwordHash: demoHash, emailVerified: true, role: Role.ORGANIZER },
    create: {
      email: "organizer@demo.local",
      passwordHash: demoHash,
      role: Role.ORGANIZER,
      emailVerified: true,
    },
  });
  await prisma.organizerProfile.upsert({
    where: { userId: demoOrgUser.id },
    update: {
      brandName: "Demo Organizer",
      companyName: "Demo Events Ltd.",
      contactName: "Demo Organizer",
      supportEmail: "organizer@demo.local",
      phone: "+8801700000001",
      approvalStatus: OrganizerApprovalStatus.APPROVED,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
    },
    create: {
      userId: demoOrgUser.id,
      brandName: "Demo Organizer",
      companyName: "Demo Events Ltd.",
      contactName: "Demo Organizer",
      supportEmail: "organizer@demo.local",
      phone: "+8801700000001",
      approvalStatus: OrganizerApprovalStatus.APPROVED,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
    },
  });
  const demoOrgProfile = await prisma.organizerProfile.findUnique({
    where: { userId: demoOrgUser.id },
  });

  await prisma.organizerPayoutSettings.upsert({
    where: { organizerProfileId: demoOrgProfile!.id },
    update: {
      stripeOnboardingStatus: StripeOnboardingStatus.NOT_STARTED,
    },
    create: {
      organizerProfileId: demoOrgProfile!.id,
      stripeOnboardingStatus: StripeOnboardingStatus.NOT_STARTED,
    },
  });
  console.log("✅ Demo organizer: organizer@demo.local / Demo123!");

  const demoEventStartAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const demoEventEndAt = new Date(demoEventStartAt.getTime() + 3 * 60 * 60 * 1000);

  const demoEvent = await prisma.event.upsert({
    where: { slug: "demo-organizer-launch-night-2026" },
    update: {
      organizerProfileId: demoOrgProfile!.id,
      venueId: venue.id,
      startAt: demoEventStartAt,
      endAt: demoEventEndAt,
      publishedAt: new Date(),
      status: EventStatus.PUBLISHED,
    },
    create: {
      organizerProfileId: demoOrgProfile!.id,
      categoryId: categoryMap["Conference"],
      venueId: venue.id,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      title: "Demo Organizer Launch Night 2026",
      slug: "demo-organizer-launch-night-2026",
      description: "A lightweight demo event for scanner testing and end-to-end QA.",
      contactEmail: "organizer@demo.local",
      startAt: demoEventStartAt,
      endAt: demoEventEndAt,
      timezone: "Asia/Dhaka",
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      commissionPct: 8.5,
      gstPct: 15,
      tags: ["demo", "scanner"],
    },
  });

  await prisma.ticketType.upsert({
    where: { id: "demo-org-tt-general" },
    update: {
      eventId: demoEvent.id,
      name: "Demo General Admission",
      quantity: 50,
      sortOrder: 1,
    },
    create: {
      id: "demo-org-tt-general",
      eventId: demoEvent.id,
      name: "Demo General Admission",
      price: 0,
      quantity: 50,
      sold: 0,
      sortOrder: 1,
    },
  });
  console.log("✅ Demo organizer event: Demo Organizer Launch Night 2026");

  // ── Demo attendee ───────────────────────────────────────────────────────
  const attendeeUser = await prisma.user.upsert({
    where: { email: "attendee@demo.local" },
    update: { passwordHash: demoHash, emailVerified: true },
    create: {
      email: "attendee@demo.local",
      passwordHash: demoHash,
      role: Role.ATTENDEE,
      emailVerified: true,
    },
  });
  await prisma.attendeeProfile.upsert({
    where: { userId: attendeeUser.id },
    update: {},
    create: {
      userId: attendeeUser.id,
      displayName: "Demo Attendee",
    },
  });
  console.log("✅ Demo attendee: attendee@demo.local / Demo123!");

  console.log("\n─────────────────────────────────────────────────────────");
  console.log("🎉 Setup complete!");
  console.log("─────────────────────────────────────────────────────────");
  console.log("Admin:     admin@eventsbox.local            / Admin123!");
  console.log("Organizer: jubayerjuhan.info@gmail.com      / Iamjuhan123");
  console.log("Organizer: organizer@demo.local             / Demo123!");
  console.log("Attendee:  attendee@demo.local              / Demo123!");
  console.log("─────────────────────────────────────────────────────────");
  console.log("Event: /events/jubayer-events-grand-opening-2026");
  console.log("Venue: The Dhaka Grand Amphitheatre (500 cap + seating map)");
  console.log("Promo: JUHAN20 (20% off)");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("❌ Setup failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
