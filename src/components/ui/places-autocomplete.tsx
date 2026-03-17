"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/src/lib/utils";

export interface PlaceResult {
  address: string;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lng?: number;
}

interface PlacesAutocompleteProps {
  onSelect: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

interface GmpPlace {
  addressComponents?: AddressComponent[];
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number };
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
}

interface PlacePrediction {
  text: { toString: () => string };
  toPlace: () => GmpPlace;
}

interface Suggestion {
  placePrediction: PlacePrediction;
}

type SessionToken = object;

interface MapsPlaces {
  AutocompleteSessionToken: new () => SessionToken;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (req: {
      input: string;
      sessionToken: SessionToken;
    }) => Promise<{ suggestions: Suggestion[] }>;
  };
}

declare const window: Window & {
  google?: { maps?: { places?: MapsPlaces } };
};

function getComponent(
  c: AddressComponent[],
  type: string,
  key: "longText" | "shortText" = "longText",
) {
  return c.find((x) => x.types.includes(type))?.[key] ?? "";
}

let mapsLoaded = false;
let mapsLoading = false;
const mapsCallbacks: (() => void)[] = [];

function loadMapsApi(apiKey: string, cb: () => void) {
  if (mapsLoaded) { cb(); return; }
  mapsCallbacks.push(cb);
  if (mapsLoading) return;
  mapsLoading = true;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
  script.async = true;
  script.defer = true;
  script.onload = () => {
    mapsLoaded = true;
    mapsCallbacks.forEach((fn) => fn());
    mapsCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

export function PlacesAutocomplete({
  onSelect,
  placeholder = "Search address...",
  className,
}: PlacesAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const sessionTokenRef = useRef<SessionToken | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => { onSelectRef.current = onSelect; });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    loadMapsApi(key, () => setReady(true));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!ready || !input.trim() || !window.google?.maps?.places) {
      setSuggestions([]);
      return;
    }
    const places = window.google.maps.places;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new places.AutocompleteSessionToken();
    }
    try {
      const { suggestions: results } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
        });
      setSuggestions(results);
      setOpen(results.length > 0);
    } catch {
      setSuggestions([]);
    }
  }, [ready]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  }

  async function handleSelect(suggestion: Suggestion) {
    const label = suggestion.placePrediction.text.toString();
    setQuery(label);
    setOpen(false);
    setSuggestions([]);
    sessionTokenRef.current = null;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents", "formattedAddress", "location"] });
      const c = place.addressComponents ?? [];
      const street = [getComponent(c, "street_number"), getComponent(c, "route")]
        .filter(Boolean).join(" ");
      onSelectRef.current({
        address: street || place.formattedAddress || "",
        city:
          getComponent(c, "locality") ||
          getComponent(c, "sublocality_level_1") ||
          getComponent(c, "postal_town"),
        state: getComponent(c, "administrative_area_level_1"),
        country: getComponent(c, "country"),
        countryCode: getComponent(c, "country", "shortText"),
        lat: place.location?.lat(),
        lng: place.location?.lng(),
      });
    } catch (err) {
      console.error("[PlacesAutocomplete] fetchFields failed", err);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus-visible:border-[rgb(var(--theme-accent-rgb)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.2)]",
          className,
        )}
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="cursor-pointer px-4 py-2.5 text-sm text-neutral-800 hover:bg-[rgb(var(--theme-accent-rgb)/0.06)] hover:text-[var(--theme-accent)]"
            >
              {s.placePrediction.text.toString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
