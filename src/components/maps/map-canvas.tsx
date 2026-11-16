"use client";

import dynamic from "next/dynamic";
import type { MapMarker, MapShape } from "@/components/maps/kos-map";

const KosMap = dynamic(() => import("@/components/maps/kos-map").then((mod) => mod.KosMap), {
  ssr: false,
  loading: () => <div className="map-loading h-full w-full">Memuat peta…</div>,
});

export function MapCanvas({
  markers,
  shapes,
  onPick,
  onSelect,
  focusId,
  fitIds,
  fitPath,
  showPreview,
  className,
}: {
  markers: MapMarker[];
  shapes?: MapShape[];
  onPick?: (coords: { latitude: number; longitude: number }) => void;
  onSelect?: (id: string) => void;
  focusId?: string | null;
  fitIds?: string[];
  fitPath?: number[][] | null;
  showPreview?: boolean;
  className?: string;
}) {
  return (
    <div className={className ?? "map-frame"}>
      <KosMap
        markers={markers}
        shapes={shapes}
        onPick={onPick}
        onSelect={onSelect}
        focusId={focusId}
        fitIds={fitIds}
        fitPath={fitPath}
        showPreview={showPreview}
        className="h-full w-full"
      />
    </div>
  );
}
