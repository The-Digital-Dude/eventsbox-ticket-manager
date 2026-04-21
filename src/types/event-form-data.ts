type CountryRow = { id: string; code: string; name: string };
type StateRow = { id: string; code?: string | null; name: string; countryId: string | null; cities: { id: string; name: string }[] };
type PlaceSelection = {
  country?: string;
  countryCode?: string;
  state?: string;
  stateCode?: string;
  city?: string;
};

export type EventDetailsFormData = {
  title: string;
  description: string;
  categoryId: string;
  venueId: string;
  countryId: string;
  stateId: string;
  cityName: string;
  startAt: string;
  endAt: string;
  timezone: string;
  contactEmail: string;
  contactPhone: string;
  heroImage: string;
  videoUrl: string;
  cancelPolicy: string;
  refundPolicy: string;
  currency: string;
  commissionPct: string;
  gstPct: string;
  platformFeeFixed: string;
  tags: string[];
  audience: string;
  lat?: number;
  lng?: number;
  stateName: string;
  cityId: string;
};

export interface LocationData { countryId?: string; stateId?: string; cityId?: string; }

export function matchLocation(place: PlaceSelection, options: { countries: CountryRow[]; states: StateRow[]; }): LocationData {
    const country = options.countries.find(c => place.country && c.name === place.country) || options.countries.find(c => place.countryCode && c.code === place.countryCode);
    const state = options.states.find(s => place.state && s.name === place.state) || options.states.find(s => place.stateCode && s.code === place.stateCode);
    const city = state?.cities.find(c => place.city && c.name === place.city);

    return {
        countryId: country?.id,
        stateId: state?.id,
        cityId: city?.id,
    };
}
