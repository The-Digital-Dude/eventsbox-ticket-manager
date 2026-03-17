/**
 * Fuzzy-match a Google Places name against a DB location name.
 * Google often returns "Dhaka Division" while the DB has "Dhaka".
 */
function fuzzyMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

type CountryRow = { id: string; code: string; name: string };
type CityRow = { id: string; name: string };
type StateRow = { id: string; name: string; cities: CityRow[] };

export function matchLocation(
  place: { countryCode?: string; state?: string; city?: string },
  data: { countries: CountryRow[]; states: StateRow[] },
): { countryId: string | null; stateId: string | null; cityId: string | null } {
  let countryId: string | null = null;
  let stateId: string | null = null;
  let cityId: string | null = null;

  if (place.countryCode) {
    countryId = data.countries.find((c) => c.code === place.countryCode)?.id ?? null;
  }

  if (place.state) {
    const matchedState = data.states.find((s) => fuzzyMatch(s.name, place.state!));
    if (matchedState) {
      stateId = matchedState.id;

      if (place.city) {
        const matchedCity = matchedState.cities.find((c) => fuzzyMatch(c.name, place.city!));
        if (matchedCity) cityId = matchedCity.id;
      }
    }
  }

  return { countryId, stateId, cityId };
}
