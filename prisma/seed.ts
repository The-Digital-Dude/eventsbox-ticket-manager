import { PrismaClient, PayoutMode, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin123!", 10);

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

  const categories = ["Concert", "Sports", "Conference", "Workshop"];
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  const states = [
    { code: "BD-DHA", name: "Dhaka", cities: ["Dhaka", "Gazipur"] },
    { code: "BD-CTG", name: "Chattogram", cities: ["Chattogram", "Cox's Bazar"] },
  ];

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
