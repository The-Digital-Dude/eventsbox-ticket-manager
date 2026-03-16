"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/src/lib/utils";

export interface PlaceResult {
  address: string;
  addressLine2?: string;
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

// Minimal typings for the Google Maps Places API subset we use
interface GeocoderAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface LatLng {
  lat: () => number;
  lng: () => number;
}

interface PlaceGeometry {
  location: LatLng;
}

interface GooglePlace {
  formatted_address?: string;
  address_components?: GeocoderAddressComponent[];
  geometry?: PlaceGeometry;
}

interface GoogleAutocomplete {
  addListener: (event: string, handler: () => void) => void;
  getPlace: () => GooglePlace;
}

interface GoogleMapsWindow {
  google?: {
    maps?: {
      places?: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts?: { types?: string[] },
        ) => GoogleAutocomplete;
      };
      event?: {
        clearInstanceListeners: (instance: unknown) => void;
      };
    };
  };
}

declare const window: Window & GoogleMapsWindow;

function getComponent(
  components: GeocoderAddressComponent[],
  type: string,
  nameType: "long_name" | "short_name" = "long_name",
): string {
  return components.find((c) => c.types.includes(type))?.[nameType] ?? "";
}

export function PlacesAutocomplete({ onSelect, placeholder = "Search address...", className }: PlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);

  useEffect(() => {
    function initAutocomplete() {
      if (!inputRef.current || !window.google?.maps?.places) return;
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
      });
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current?.getPlace();
        if (!place || !place.address_components) return;

        const components = place.address_components;
        const streetNumber = getComponent(components, "street_number");
        const route = getComponent(components, "route");
        const addressLine1 = [streetNumber, route].filter(Boolean).join(" ") || place.formatted_address || "";
        const city =
          getComponent(components, "locality") ||
          getComponent(components, "sublocality_level_1") ||
          getComponent(components, "postal_town");
        const state = getComponent(components, "administrative_area_level_1");
        const country = getComponent(components, "country");
        const countryCode = getComponent(components, "country", "short_name");
        const lat = place.geometry?.location?.lat();
        const lng = place.geometry?.location?.lng();

        onSelect({ address: addressLine1, city, state, country, countryCode, lat, lng });
      });
    }

    if (typeof window !== "undefined") {
      if (window.google?.maps?.places) {
        initAutocomplete();
      } else {
        // Check if script is already loading
        const existingScript = document.querySelector(
          'script[src*="maps.googleapis.com/maps/api/js"]',
        );
        if (existingScript) {
          existingScript.addEventListener("load", initAutocomplete);
        } else {
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
          script.async = true;
          script.defer = true;
          script.onload = () => initAutocomplete();
          document.head.appendChild(script);
        }
      }
    }

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={placeholder}
      className={cn(
        "flex h-10 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition focus-visible:border-[rgb(var(--theme-accent-rgb)/0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--theme-accent-rgb)/0.2)]",
        className,
      )}
    />
  );
}
