import {
  PrismaClient,
  PayoutMode,
  Role,
  OrganizerApprovalStatus,
  StripeOnboardingStatus,
  EventStatus,
  OrderStatus,
  DiscountType,
  CancellationRequestStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);
  const demoHash = await bcrypt.hash("Demo123!", 10);

  // ── Platform config ──────────────────────────────────────────────────────
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

  // ── Admin ─────────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "admin@eventsbox.local" },
    update: { passwordHash, role: Role.SUPER_ADMIN, emailVerified: true },
    create: {
      email: "admin@eventsbox.local",
      passwordHash,
      role: Role.SUPER_ADMIN,
      emailVerified: true,
    },
  });

  // ── Categories ────────────────────────────────────────────────────────────
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

  // ── States & Cities ───────────────────────────────────────────────────────
  const states = [
    { code: "BD-DHA", name: "Dhaka", cities: ["Dhaka", "Gazipur"] },
    { code: "BD-CTG", name: "Chattogram", cities: ["Chattogram", "Cox's Bazar"] },
  ];
  const dhaka = await prisma.state.upsert({
    where: { code: "BD-DHA" },
    update: { name: "Dhaka" },
    create: { code: "BD-DHA", name: "Dhaka" },
  });
  const dhakaCity = await prisma.city.upsert({
    where: { stateId_name: { stateId: dhaka.id, name: "Dhaka" } },
    update: {},
    create: { name: "Dhaka", stateId: dhaka.id },
  });
  for (const stateData of states) {
    const state = await prisma.state.upsert({
      where: { code: stateData.code },
      update: { name: stateData.name },
      create: { code: stateData.code, name: stateData.name },
    });
    for (const cityName of stateData.cities) {
      await prisma.city.upsert({
        where: { stateId_name: { stateId: state.id, name: cityName } },
        update: {},
        create: { name: cityName, stateId: state.id },
      });
    }
  }

  // ── Organizer user ────────────────────────────────────────────────────────
  const organizerUser = await prisma.user.upsert({
    where: { email: "organizer@demo.local" },
    update: { passwordHash: demoHash, emailVerified: true },
    create: {
      email: "organizer@demo.local",
      passwordHash: demoHash,
      role: Role.ORGANIZER,
      emailVerified: true,
    },
  });

  const organizerProfile = await prisma.organizerProfile.upsert({
    where: { userId: organizerUser.id },
    update: {},
    create: {
      userId: organizerUser.id,
      brandName: "Demo Events Co.",
      companyName: "Demo Events Pty Ltd",
      contactName: "Alex Organizer",
      supportEmail: "organizer@demo.local",
      phone: "+8801700000001",
      approvalStatus: OrganizerApprovalStatus.APPROVED,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
    },
  });

  await prisma.organizerPayoutSettings.upsert({
    where: { organizerProfileId: organizerProfile.id },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      stripeOnboardingStatus: StripeOnboardingStatus.COMPLETED,
      stripeAccountId: "acct_demo",
    },
  });

  // ── Venue ─────────────────────────────────────────────────────────────────
  const venue = await prisma.venue.upsert({
    where: { id: "demo-venue-001" },
    update: {},
    create: {
      id: "demo-venue-001",
      organizerProfileId: organizerProfile.id,
      name: "Bashundhara Convention Center",
      addressLine1: "Bashundhara City, Dhaka 1229",
      stateId: dhaka.id,
      cityId: dhakaCity.id,
    },
  });

  // ── Events ────────────────────────────────────────────────────────────────
  const now = new Date();
  const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const inThreeWeeks = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);
  const inTwoWeeksEnd = new Date(inTwoWeeks.getTime() + 3 * 60 * 60 * 1000);
  const inThreeWeeksEnd = new Date(inThreeWeeks.getTime() + 4 * 60 * 60 * 1000);
  const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const lastMonthEnd = new Date(lastMonth.getTime() + 3 * 60 * 60 * 1000);

  // Event 1: Upcoming published — featured
  const event1 = await prisma.event.upsert({
    where: { slug: "dhaka-music-festival-2026" },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      categoryId: categoryMap["Concert"],
      venueId: venue.id,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      title: "Dhaka Music Festival 2026",
      slug: "dhaka-music-festival-2026",
      description:
        "The biggest music festival in Dhaka featuring top local and international artists. Three stages, 20+ acts, food vendors, and an unforgettable night under the stars.",
      contactEmail: "events@demo.local",
      startAt: inTwoWeeks,
      endAt: inTwoWeeksEnd,
      timezone: "Asia/Dhaka",
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      commissionPct: 8.5,
      gstPct: 15,
      isFeatured: true,
    },
  });

  // Event 2: Upcoming published — sold-out (for waitlist demo)
  const event2 = await prisma.event.upsert({
    where: { slug: "dhaka-comedy-night-2026" },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      categoryId: categoryMap["Comedy"],
      venueId: venue.id,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      title: "Dhaka Comedy Night 2026",
      slug: "dhaka-comedy-night-2026",
      description:
        "An evening of non-stop laughs with Bangladesh's top stand-up comedians. Limited seats — sell-out expected!",
      contactEmail: "events@demo.local",
      startAt: inThreeWeeks,
      endAt: inThreeWeeksEnd,
      timezone: "Asia/Dhaka",
      status: EventStatus.PUBLISHED,
      publishedAt: new Date(),
      commissionPct: 8.5,
      gstPct: 15,
      isFeatured: false,
    },
  });

  // Event 3: Past event — for analytics
  const event3 = await prisma.event.upsert({
    where: { slug: "dhaka-tech-conference-2025" },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      categoryId: categoryMap["Conference"],
      venueId: venue.id,
      stateId: dhaka.id,
      cityId: dhakaCity.id,
      title: "Dhaka Tech Conference 2025",
      slug: "dhaka-tech-conference-2025",
      description:
        "Bangladesh's premier technology conference. Keynotes, workshops, and networking with 500+ tech professionals.",
      contactEmail: "events@demo.local",
      startAt: lastMonth,
      endAt: lastMonthEnd,
      timezone: "Asia/Dhaka",
      status: EventStatus.PUBLISHED,
      publishedAt: lastMonth,
      commissionPct: 8.5,
      gstPct: 15,
    },
  });

  // ── Ticket Types ──────────────────────────────────────────────────────────

  // Event 1 tickets
  const tt1General = await prisma.ticketType.upsert({
    where: { id: "tt-e1-general" },
    update: {},
    create: {
      id: "tt-e1-general",
      eventId: event1.id,
      name: "General Admission",
      price: 1500,
      quantity: 200,
      sold: 42,
      sortOrder: 1,
    },
  });

  const tt1VIP = await prisma.ticketType.upsert({
    where: { id: "tt-e1-vip" },
    update: {},
    create: {
      id: "tt-e1-vip",
      eventId: event1.id,
      name: "VIP — Front Row",
      price: 4500,
      quantity: 50,
      sold: 8,
      sortOrder: 2,
    },
  });

  // Event 2 tickets — sold out (quantity = sold)
  const tt2General = await prisma.ticketType.upsert({
    where: { id: "tt-e2-general" },
    update: {},
    create: {
      id: "tt-e2-general",
      eventId: event2.id,
      name: "General Admission",
      price: 800,
      quantity: 100,
      sold: 100,
      sortOrder: 1,
    },
  });

  // Event 3 tickets — past event
  const tt3Standard = await prisma.ticketType.upsert({
    where: { id: "tt-e3-standard" },
    update: {},
    create: {
      id: "tt-e3-standard",
      eventId: event3.id,
      name: "Standard",
      price: 2000,
      quantity: 300,
      sold: 187,
      sortOrder: 1,
    },
  });

  // ── Promo Code ────────────────────────────────────────────────────────────
  await prisma.promoCode.upsert({
    where: { code: "DEMO20" },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      eventId: event1.id,
      code: "DEMO20",
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      maxUses: 50,
      usedCount: 3,
      isActive: true,
    },
  });

  await prisma.promoCode.upsert({
    where: { code: "FLAT500" },
    update: {},
    create: {
      organizerProfileId: organizerProfile.id,
      code: "FLAT500",
      discountType: DiscountType.FIXED,
      discountValue: 500,
      maxUses: 20,
      usedCount: 1,
      isActive: true,
    },
  });

  // ── Attendee user ─────────────────────────────────────────────────────────
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

  const attendeeProfile = await prisma.attendeeProfile.upsert({
    where: { userId: attendeeUser.id },
    update: {},
    create: {
      userId: attendeeUser.id,
      displayName: "Jamie Attendee",
    },
  });

  // ── PAID order (event 1 — general, with promo) ────────────────────────────
  const existingOrder1 = await prisma.order.findFirst({
    where: { buyerEmail: "attendee@demo.local", eventId: event1.id },
  });

  if (!existingOrder1) {
    const order1 = await prisma.order.create({
      data: {
        eventId: event1.id,
        attendeeUserId: attendeeProfile.id,
        buyerEmail: "attendee@demo.local",
        buyerName: "Jamie Attendee",
        subtotal: 3000,
        discountAmount: 600,
        platformFee: 204,
        gst: 30.6,
        total: 2634.6,
        status: OrderStatus.PAID,
        paidAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    });
    const item1 = await prisma.orderItem.create({
      data: {
        orderId: order1.id,
        ticketTypeId: tt1General.id,
        quantity: 2,
        unitPrice: 1500,
        subtotal: 3000,
      },
    });

    await prisma.qRTicket.create({
      data: {
        orderId: order1.id,
        orderItemId: item1.id,
        ticketNumber: "TKT-DEMO-001",
      },
    });

    await prisma.qRTicket.create({
      data: {
        orderId: order1.id,
        orderItemId: item1.id,
        ticketNumber: "TKT-DEMO-002",
      },
    });
  }

  // ── PAID order (event 1 — VIP, checked in) ───────────────────────────────
  const existingOrder2 = await prisma.order.findFirst({
    where: { buyerEmail: "vip@demo.local", eventId: event1.id },
  });

  if (!existingOrder2) {
    const order2 = await prisma.order.create({
      data: {
        eventId: event1.id,
        buyerEmail: "vip@demo.local",
        buyerName: "Sarah VIP",
        subtotal: 4500,
        platformFee: 382.5,
        gst: 57.38,
        total: 4939.88,
        status: OrderStatus.PAID,
        paidAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
    });

    const item2 = await prisma.orderItem.create({
      data: {
        orderId: order2.id,
        ticketTypeId: tt1VIP.id,
        quantity: 1,
        unitPrice: 4500,
        subtotal: 4500,
      },
    });

    await prisma.qRTicket.create({
      data: {
        orderId: order2.id,
        orderItemId: item2.id,
        ticketNumber: "TKT-VIP-001",
        checkedInAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ── PAID order with cancellation request ─────────────────────────────────
  const existingOrder3 = await prisma.order.findFirst({
    where: { buyerEmail: "cancel@demo.local", eventId: event1.id },
  });

  if (!existingOrder3) {
    const order3 = await prisma.order.create({
      data: {
        eventId: event1.id,
        attendeeUserId: attendeeProfile.id,
        buyerEmail: "cancel@demo.local",
        buyerName: "Chris Cancel",
        subtotal: 1500,
        platformFee: 127.5,
        gst: 19.13,
        total: 1646.63,
        status: OrderStatus.PAID,
        paidAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    });

    const item3 = await prisma.orderItem.create({
      data: {
        orderId: order3.id,
        ticketTypeId: tt1General.id,
        quantity: 1,
        unitPrice: 1500,
        subtotal: 1500,
      },
    });

    await prisma.qRTicket.create({
      data: {
        orderId: order3.id,
        orderItemId: item3.id,
        ticketNumber: "TKT-DEMO-003",
      },
    });

    await prisma.cancellationRequest.create({
      data: {
        orderId: order3.id,
        attendeeUserId: attendeeProfile.id,
        reason: "Change of plans — can no longer attend.",
        status: CancellationRequestStatus.PENDING,
      },
    });
  }

  // ── Past event orders (for analytics revenue) ─────────────────────────────
  const pastBuyers = [
    { email: "buyer1@demo.local", name: "Buyer One" },
    { email: "buyer2@demo.local", name: "Buyer Two" },
    { email: "buyer3@demo.local", name: "Buyer Three" },
  ];

  for (const buyer of pastBuyers) {
    const existing = await prisma.order.findFirst({
      where: { buyerEmail: buyer.email, eventId: event3.id },
    });
    if (!existing) {
      const o = await prisma.order.create({
        data: {
          eventId: event3.id,
          buyerEmail: buyer.email,
          buyerName: buyer.name,
          subtotal: 2000,
          platformFee: 170,
          gst: 25.5,
          total: 2195.5,
          status: OrderStatus.PAID,
          paidAt: new Date(lastMonth.getTime() + Math.random() * 24 * 60 * 60 * 1000),
        },
      });
      const i = await prisma.orderItem.create({
        data: {
          orderId: o.id,
          ticketTypeId: tt3Standard.id,
          quantity: 1,
          unitPrice: 2000,
          subtotal: 2000,
        },
      });
      await prisma.qRTicket.create({
        data: {
          orderId: o.id,
          orderItemId: i.id,
          ticketNumber: `TKT-CONF-${buyer.email.split("@")[0].toUpperCase()}`,
          checkedInAt: lastMonth,
        },
      });
    }
  }

  // ── Waitlist entries (event 2 — sold out) ─────────────────────────────────
  const waitlistEntries = [
    { email: "wait1@demo.local", name: "Waiting Alice" },
    { email: "wait2@demo.local", name: "Waiting Bob" },
  ];

  for (const entry of waitlistEntries) {
    const existing = await prisma.waitlist.findFirst({
      where: { email: entry.email, eventId: event2.id },
    });
    if (!existing) {
      await prisma.waitlist.create({
        data: {
          eventId: event2.id,
          ticketTypeId: tt2General.id,
          email: entry.email,
          name: entry.name,
        },
      });
    }
  }

  console.log("✅ Seed complete");
  console.log("─────────────────────────────────────");
  console.log("Admin:     admin@eventsbox.local / Admin123!");
  console.log("Organizer: organizer@demo.local  / Demo123!");
  console.log("Attendee:  attendee@demo.local   / Demo123!");
  console.log("─────────────────────────────────────");
  console.log("Events:");
  console.log("  /events/dhaka-music-festival-2026  (featured, tickets available)");
  console.log("  /events/dhaka-comedy-night-2026    (sold out, waitlist)");
  console.log("  /events/dhaka-tech-conference-2025 (past, analytics data)");
  console.log("Promo codes: DEMO20 (20% off), FLAT500 (৳500 off)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
