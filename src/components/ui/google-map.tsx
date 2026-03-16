"use client";

interface GoogleMapProps {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  venueName?: string | null;
  className?: string;
}

export function GoogleMap({ lat, lng, address, venueName, className }: GoogleMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) return null;

  let mapUrl: string | null = null;

  if (lat != null && lng != null) {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}`;
  } else if (address) {
    mapUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}`;
  }

  if (!mapUrl) return null;

  return (
    <div className={`relative h-64 w-full overflow-hidden rounded-2xl border border-[var(--border)] shadow-sm ${className ?? ""}`}>
      <iframe
        src={mapUrl}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Map for ${venueName ?? address}`}
      />
    </div>
  );
}
