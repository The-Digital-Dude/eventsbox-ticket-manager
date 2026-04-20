import { prisma } from "@/src/lib/db";

type ResolveLocationInput = {
  countryId?: string | null;
  stateId?: string | null;
  stateName?: string | null;
  cityId?: string | null;
  cityName?: string | null;
};

function normalizeName(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function buildStateCode(name: string) {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20);
  return `MANUAL-${slug || "STATE"}-${Date.now().toString(36).toUpperCase()}`;
}

export async function resolveLocationIds(input: ResolveLocationInput) {
  const stateName = normalizeName(input.stateName);
  const cityName = normalizeName(input.cityName);

  let stateId = input.stateId ?? null;
  let cityId = input.cityId ?? null;

  if (!stateId && stateName) {
    const existingState = await prisma.state.findFirst({
      where: { name: { equals: stateName, mode: "insensitive" } },
      select: { id: true },
    });

    if (existingState) {
      stateId = existingState.id;
    } else {
      const createdState = await prisma.state.create({
        data: {
          name: stateName,
          code: buildStateCode(stateName),
          countryId: input.countryId ?? null,
        },
        select: { id: true },
      });
      stateId = createdState.id;
    }
  }

  if (!cityId && cityName) {
    if (!stateId) {
      throw new Error("CITY_REQUIRES_STATE");
    }

    const existingCity = await prisma.city.findFirst({
      where: {
        stateId,
        name: { equals: cityName, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (existingCity) {
      cityId = existingCity.id;
    } else {
      const createdCity = await prisma.city.create({
        data: {
          stateId,
          name: cityName,
        },
        select: { id: true },
      });
      cityId = createdCity.id;
    }
  }

  return {
    stateId: stateId ?? undefined,
    cityId: cityId ?? undefined,
  };
}
