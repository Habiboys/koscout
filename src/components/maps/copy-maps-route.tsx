"use client";

import { useState } from "react";
import { mapsRoutePaste } from "@/lib/geo";

export function CopyMapsRoute({
  from,
  to,
}: {
  from: { latitude: number; longitude: number } | null;
  to: { latitude: number; longitude: number } | null;
}) {
  const [note, setNote] = useState("");
  if (!from || !to) return null;
  const text = mapsRoutePaste(from, to);
  return (
    <div className="row">
      <button
        className="btn secondary"
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(
            () => setNote("Tersalin. Tempel di kolom cari Google Maps."),
            () => setNote(text),
          );
        }}
      >
        Salin rute
      </button>
      <a
        className="btn secondary"
        href={`https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${to.latitude},${to.longitude}&travelmode=driving`}
        target="_blank"
        rel="noreferrer"
      >
        Buka di Google Maps
      </a>
      {note ? <span className="status">{note}</span> : null}
    </div>
  );
}
