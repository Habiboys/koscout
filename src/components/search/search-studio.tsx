"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FACILITIES, facilityLabel } from "@/lib/facilities";
import { circlePolygon, haversineKm } from "@/lib/geo";
import { commuteLabel, formatIdr, formatKm, formatPercent } from "@/lib/format";
import { availabilityLabel, displayGender, genderLabel, locationQualityLabel } from "@/lib/labels";
import type { ListingWithCommute, SearchFilters } from "@/server/listings";
import { MapCanvas } from "@/components/maps/map-canvas";
import { CopyMapsRoute } from "@/components/maps/copy-maps-route";
import { LISTING_COLORS, type MapMarker, type MapShape } from "@/components/maps/kos-map";
import { SearchCapture, type CaptureSource, type KosGender } from "@/components/import/search-capture";
import { SourceBadge, SourceLink } from "@/components/listings/source-badge";
import { matchesListingQuery } from "@/lib/search-query";
import { COMPARE_LIMIT } from "@/server/search-params";
import { SOURCE_FILTERS, describeSource } from "@/lib/sources";
import type { ScoreBreakdown } from "@/server/scoring/score";

type OfficeView = {
  id?: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  isActive?: boolean;
};

export function SearchStudio({
  filters,
  office,
  offices,
  matches,
  pendingCommute,
  excludedIncomplete,
  outsideArea,
  focusKm,
  radiusIgnored,
  scores,
  warnings,
}: {
  filters: SearchFilters;
  office: OfficeView | null;
  offices: OfficeView[];
  matches: ListingWithCommute[];
  pendingCommute: ListingWithCommute[];
  excludedIncomplete: number;
  outsideArea: number;
  focusKm: number | null;
  radiusIgnored: boolean;
  scores: Record<string, ScoreBreakdown>;
  warnings: Record<string, string[]>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [officeDraft, setOfficeDraft] = useState<OfficeView>(
    office ?? { name: "Kantor", address: "", latitude: -6.2088, longitude: 106.822 },
  );
  const [placing, setPlacing] = useState(!office);
  const [placeText, setPlaceText] = useState("");
  const [status, setStatus] = useState("");
  const [isochrone, setIsochrone] = useState<MapShape["geojson"] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickedRoute, setPickedRoute] = useState<{ id: string; geometry: { type: "LineString"; coordinates: number[][] } } | null>(null);
  const [sortBy, setSortBy] = useState<
    "distance_asc" | "duration_asc" | "price_asc" | "price_desc" | "score_desc" | "name_asc"
  >("distance_asc");
  const [sources, setSources] = useState<CaptureSource[]>(
    filters.source === "rukita" || filters.source === "mamikos" ? [filters.source] : ["rukita", "mamikos"],
  );
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapOpen, setMapOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [genders, setGenders] = useState<KosGender[]>(filters.gender);

  useEffect(() => {
    if (filters.source === "rukita" || filters.source === "mamikos") setSources([filters.source]);
  }, [filters.source]);

  useEffect(() => {
    setGenders(filters.gender);
  }, [filters.gender]);

  function pickGenders(next: KosGender[]) {
    setGenders(next);
    const params = new URLSearchParams(window.location.search);
    params.delete("gender");
    for (const gender of next) params.append("gender", gender);
    const query = params.toString();
    router.push(query ? `/search?${query}` : "/search");
  }

  const markers = useMemo(() => {
    const items: MapMarker[] = [...matches, ...pendingCommute]
      .filter((listing) => listing.latitude != null && listing.longitude != null)
      .map((listing, index) => ({
        id: listing.id,
        latitude: listing.latitude as number,
        longitude: listing.longitude as number,
        label: listing.name,
        tone: "listing" as const,
        color: LISTING_COLORS[index % LISTING_COLORS.length],
        href: `/listings/${listing.id}`,
        preview: {
          price: formatIdr(listing.priceAmount),
          lines: [
            `${formatKm(listing.distanceKm)} · ${commuteLabel(listing.routeStatus, listing.durationSeconds)}`,
            `${genderLabel(displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description))}${scores[listing.id]?.overall != null ? ` · skor ${scores[listing.id].overall}` : ""}`,
            ...(warnings[listing.id] ?? []),
          ],
          badges: [
            describeSource(listing.sourceName, listing.sourceUrl).label,
            genderLabel(displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description)),
            ...listing.facilities.map(facilityLabel),
          ],
          imageUrl: listing.imageUrls[0] ?? null,
          sourceUrl: listing.sourceUrl,
        },
      }));
    if (office) {
      items.unshift({
        id: "office",
        latitude: office.latitude,
        longitude: office.longitude,
        label: office.name,
        tone: "office",
        color: "#b8612f",
        preview: {
          lines: [office.address ?? "Lokasi acuan untuk jarak dan waktu tempuh."],
        },
      });
    }
    return items;
  }, [matches, office, pendingCommute, scores, warnings]);

  function copyNearestLinks() {
    if (nearest.length === 0) return;
    const origin = window.location.origin;
    const text = nearest
      .map((item, index) => {
        const link = item.listing.sourceUrl ?? `${origin}/listings/${item.listing.id}`;
        return `${index + 1}. ${item.listing.name} — ${link}`;
      })
      .join("\n");
    void navigator.clipboard.writeText(text).then(
      () => setStatus(`${nearest.length} tautan kos terdekat tersalin.`),
      () => setStatus(text),
    );
  }

  function toggle(id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= COMPARE_LIMIT) return current;
      return [...current, id];
    });
  }

  async function resolvePlace() {
    const text = placeText.trim() || officeDraft.address || "";
    if (text.length < 3) {
      setStatus("Tempel tautan Google Maps, atau ketik alamat.");
      return;
    }
    setStatus("Membaca koordinat…");
    const response = await fetch("/api/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await response.json()) as {
      latitude?: number;
      longitude?: number;
      label?: string;
      name?: string | null;
      error?: string;
    };
    if (!response.ok || data.latitude == null || data.longitude == null) {
      setStatus(data.error ?? "Koordinat tidak ketemu.");
      return;
    }
    const keepName = officeDraft.name.trim() !== "" && officeDraft.name.trim() !== "Kantor";
    setOfficeDraft({
      ...officeDraft,
      name: keepName ? officeDraft.name : (data.name ?? officeDraft.name),
      address: data.label ?? text,
      latitude: data.latitude,
      longitude: data.longitude,
    });
    setPlacing(true);
    setStatus(`Titik terpasang: ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`);
  }

  async function saveOffice() {
    setStatus("Menyimpan lokasi…");
    const response = await fetch("/api/office", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(officeDraft),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Lokasi gagal disimpan.");
      return;
    }
    setPlacing(false);
    setStatus("Lokasi disimpan. Jarak dihitung ulang.");
    router.refresh();
  }

  async function addOffice() {
    setStatus("Menambah lokasi…");
    const response = await fetch("/api/office", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(officeDraft),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Lokasi tambahan gagal disimpan.");
      return;
    }
    setStatus("Lokasi tambahan tersimpan. Aktifkan untuk menghitung jarak ke sana.");
    router.refresh();
  }

  async function activate(id: string) {
    setStatus("Mengganti lokasi acuan…");
    const response = await fetch("/api/office", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      setStatus("Lokasi gagal diaktifkan.");
      return;
    }
    setStatus("Lokasi acuan diganti.");
    router.refresh();
  }

  function pointKm(listing: ListingWithCommute): number | null {
    if (here && listing.latitude != null && listing.longitude != null) {
      return haversineKm(here, { latitude: listing.latitude, longitude: listing.longitude });
    }
    return listing.distanceKm;
  }

  const visible = useMemo(() => {
    const list = [...matches, ...pendingCommute].filter((listing) => {
      const sourceId = describeSource(listing.sourceName, listing.sourceUrl).id;
      if ((sourceId === "rukita" || sourceId === "mamikos") && !sources.includes(sourceId)) return false;
      const gender = displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description);
      if (genders.length > 0 && !genders.some((item) => item === gender)) return false;
      if (!matchesListingQuery(listing.name, listing.address, query)) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sortBy === "distance_asc") {
        const da = (here && a.latitude != null && a.longitude != null
          ? haversineKm(here, { latitude: a.latitude, longitude: a.longitude })
          : a.distanceKm) ?? Number.POSITIVE_INFINITY;
        const db = (here && b.latitude != null && b.longitude != null
          ? haversineKm(here, { latitude: b.latitude, longitude: b.longitude })
          : b.distanceKm) ?? Number.POSITIVE_INFINITY;
        if (da !== db) return da - db;
        return (a.priceAmount ?? Number.POSITIVE_INFINITY) - (b.priceAmount ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === "duration_asc") {
        const ta = a.durationSeconds ?? Number.POSITIVE_INFINITY;
        const tb = b.durationSeconds ?? Number.POSITIVE_INFINITY;
        if (ta !== tb) return ta - tb;
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === "price_asc") {
        const pa = a.priceAmount ?? Number.POSITIVE_INFINITY;
        const pb = b.priceAmount ?? Number.POSITIVE_INFINITY;
        if (pa !== pb) return pa - pb;
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === "price_desc") {
        const pa = a.priceAmount ?? -1;
        const pb = b.priceAmount ?? -1;
        if (pa !== pb) return pb - pa;
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      }
      if (sortBy === "score_desc") {
        const sa = scores[a.id]?.overall ?? -1;
        const sb = scores[b.id]?.overall ?? -1;
        if (sa !== sb) return sb - sa;
        return (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY);
      }
      return a.name.localeCompare(b.name, "id");
    });
    return list;
  }, [genders, here, matches, pendingCommute, query, scores, sortBy, sources]);
  const active = visible.find((item) => item.id === activeId) ?? visible[0] ?? null;
  const originName = here ? "lokasi saya" : (office?.name ?? "titik acuan");
  const originPoint = here ?? (office ? { latitude: office.latitude, longitude: office.longitude } : null);
  const nearest = useMemo(() => {
    return visible
      .filter((listing) => listing.latitude != null && listing.longitude != null)
      .map((listing) => ({
        listing,
        km:
          here && listing.latitude != null && listing.longitude != null
            ? haversineKm(here, { latitude: listing.latitude, longitude: listing.longitude })
            : listing.distanceKm,
      }))
      .sort((a, b) => (a.km ?? Number.POSITIVE_INFINITY) - (b.km ?? Number.POSITIVE_INFINITY))
      .slice(0, COMPARE_LIMIT);
  }, [here, visible]);
  const mapMarkers = useMemo(() => {
    const ids = new Set(visible.map((item) => item.id));
    return markers.filter((marker) => marker.id === "office" || ids.has(marker.id));
  }, [markers, visible]);
  const shownMarkers = useMemo(() => {
    const rankOf = new Map(nearest.map((item, index) => [item.listing.id, index + 1]));
    const items = mapMarkers
      .filter((marker) => !(here && marker.id === "office"))
      .map((marker) => {
        const rank = rankOf.get(marker.id);
        const near = nearest.find((item) => item.listing.id === marker.id);
        if (!rank || !near) return marker;
        const lines = marker.preview?.lines ? [...marker.preview.lines] : [];
        if (lines.length > 0) lines[0] = `${formatKm(near.km)} dari ${originName}`;
        else lines.push(`${formatKm(near.km)} dari ${originName}`);
        return {
          ...marker,
          rank,
          color: rank === 1 ? "#b8612f" : "#1e4638",
          preview: marker.preview ? { ...marker.preview, lines } : { lines },
        };
      });
    if (here) {
      items.unshift({
        id: "here",
        latitude: here.latitude,
        longitude: here.longitude,
        label: "Lokasi saya",
        tone: "office" as const,
        color: "#b8612f",
        preview: { lines: ["Jarak garis lurus dihitung dari titik ini. Kantor tidak diubah."] },
      });
    }
    return items;
  }, [here, mapMarkers, nearest, originName]);
  const mapFitIds = useMemo(() => {
    const searched = query.trim().length > 0;
    const targetIds = searched
      ? visible.filter((listing) => listing.latitude != null && listing.longitude != null).slice(0, 12).map((listing) => listing.id)
      : nearest.map((item) => item.listing.id);
    const ids = [here ? "here" : "office", ...targetIds];
    const known = new Set(shownMarkers.map((marker) => marker.id));
    return ids.filter((id) => known.has(id));
  }, [here, nearest, query, shownMarkers, visible]);
  const clickedPath = useMemo(() => {
    if (!activeId || !active || active.latitude == null || active.longitude == null) return null;
    const origin = here ?? (office ? { latitude: office.latitude, longitude: office.longitude } : null);
    if (!origin) return null;
    const fetched = !here && pickedRoute?.id === activeId ? pickedRoute.geometry : null;
    const stored = !here ? active.routeGeometry : null;
    return (
      fetched ??
      stored ?? {
        type: "LineString" as const,
        coordinates: [
          [origin.longitude, origin.latitude],
          [active.longitude, active.latitude],
        ],
      }
    );
  }, [active, activeId, here, office, pickedRoute]);
  const searchShapes = useMemo(() => {
    const shapes = mapShapes(here ? null : office, here ? null : (filters.radiusKm ?? focusKm), here ? null : isochrone);
    if (clickedPath && activeId) {
      shapes.push({
        id: `route-${activeId}`,
        color: "#245b8a",
        width: 5,
        geojson: clickedPath,
      });
    }
    return shapes;
  }, [activeId, clickedPath, filters.radiusKm, focusKm, here, isochrone, office]);

  useEffect(() => {
    if (query.trim()) {
      setActiveId(visible[0]?.id ?? null);
      return;
    }
    setActiveId((current) => (current && !visible.some((item) => item.id === current) ? null : current));
  }, [query, visible]);

  useEffect(() => {
    if (!activeId || here) {
      setPickedRoute(null);
      return;
    }
    const listing = [...matches, ...pendingCommute].find((item) => item.id === activeId);
    if (!listing || listing.latitude == null || listing.longitude == null) {
      setPickedRoute(null);
      return;
    }
    if (listing.routeGeometry) {
      setPickedRoute({ id: listing.id, geometry: listing.routeGeometry });
      return;
    }
    const controller = new AbortController();
    setStatus("Menghitung jalur jalan…");
    fetch(`/api/listings/${listing.id}/route`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          geometry?: { type?: string; coordinates?: number[][] };
        };
        if (!response.ok || body.geometry?.type !== "LineString" || !body.geometry.coordinates) {
          setPickedRoute(null);
          setStatus(body.error ?? "Jalur jalan belum tersedia.");
          return;
        }
        setPickedRoute({ id: listing.id, geometry: { type: "LineString", coordinates: body.geometry.coordinates } });
        setStatus("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("Jalur jalan gagal dimuat.");
      });
    return () => controller.abort();
  }, [activeId, here, matches, pendingCommute]);

  function chooseListing(id: string) {
    setMapOpen(true);
    setActiveId(id);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setStatus("Browser ini tidak bisa membaca lokasi perangkat.");
      return;
    }
    setStatus("Membaca lokasi perangkat…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHere({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setStatus("Jarak di peta dihitung dari lokasi perangkat. Titik kantor tidak diubah.");
      },
      () => setStatus("Lokasi perangkat tidak diizinkan. Jarak tetap dari titik kantor."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="row">
            <strong>{office ? office.name : "Lokasi acuan"}</strong>
            {offices.length > 1
              ? offices.map((item) => (
                  <button
                    key={item.id}
                    className={item.isActive ? "btn" : "btn secondary"}
                    type="button"
                    onClick={() => item.id && void activate(item.id)}
                  >
                    {item.name}
                  </button>
                ))
              : null}
            <button className="btn secondary" type="button" onClick={() => setPlacing((value) => !value)}>
              {placing ? "Tutup" : "Ubah lokasi"}
            </button>
          </div>
          <SearchCapture
            sources={sources}
            onSourcesChange={setSources}
            genders={genders}
            onGendersChange={pickGenders}
          />
        </div>
        {placing ? (
          <div className="stack">
            <label className="field">
              <span>Tempel tautan peta atau koordinat</span>
              <input
                type="text"
                value={placeText}
                placeholder="https://maps.app.goo.gl/... atau -6.2088, 106.822"
                onChange={(event) => setPlaceText(event.target.value)}
              />
            </label>
            <div className="row">
              <label className="field" style={{ flex: "1 1 180px" }}>
                <span>Nama lokasi</span>
                <input
                  type="text"
                  value={officeDraft.name}
                  onChange={(event) => setOfficeDraft({ ...officeDraft, name: event.target.value })}
                />
              </label>
              <label className="field" style={{ flex: "2 1 260px" }}>
                <span>Alamat</span>
                <input
                  type="text"
                  value={officeDraft.address ?? ""}
                  onChange={(event) => setOfficeDraft({ ...officeDraft, address: event.target.value })}
                />
              </label>
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => void resolvePlace()}>
                Ambil koordinat
              </button>
              <button className="btn secondary" type="button" onClick={() => void saveOffice()} disabled={!officeDraft.name.trim()}>
                Simpan lokasi
              </button>
              <button className="btn secondary" type="button" onClick={() => void addOffice()} disabled={!officeDraft.name.trim()}>
                Simpan sebagai lokasi lain
              </button>
              <span className="status">{status}</span>
            </div>
            <p className="help">
              Google Maps, tautan singkat, OpenStreetMap, atau lintang-bujur. Titik sekarang {officeDraft.latitude.toFixed(5)},{" "}
              {officeDraft.longitude.toFixed(5)}. Klik peta untuk menggeser sebelum disimpan.
            </p>
          </div>
        ) : null}
      </section>

      <section className="board">
        <form className="card card-pad stack board-side" action="/search">
          <strong>Filter</strong>
          <div className="field-grid">
            <label className="field">
              <span>Budget min.</span>
              <input type="number" name="minBudget" min={0} defaultValue={filters.minBudget ?? ""} />
            </label>
            <label className="field">
              <span>Budget maks.</span>
              <input type="number" name="maxBudget" min={0} defaultValue={filters.maxBudget ?? ""} placeholder="2000000" />
            </label>
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <span>Jenis</span>
            <p className="help">Kosongkan untuk semua. Bisa pilih lebih dari satu.</p>
            {(["putri", "putra", "campur"] as const).map((gender) => (
              <label key={gender} className="check">
                <input type="checkbox" name="gender" value={gender} defaultChecked={filters.gender.includes(gender)} />
                {genderLabel(gender)}
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Sumber</span>
            <select name="source" defaultValue={filters.source ?? ""}>
              <option value="">Semua</option>
              {SOURCE_FILTERS.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field-grid">
            <label className="field">
              <span>Radius km</span>
              <input type="number" name="radiusKm" min={0} step="0.1" defaultValue={filters.radiusKm ?? ""} />
            </label>
            <label className="field">
              <span>Maks. menit</span>
              <input type="number" name="maxMinutes" min={0} defaultValue={filters.maxMinutes ?? ""} />
            </label>
          </div>
          <label className="field">
            <span>Gaji / bulan</span>
            <input type="number" name="salary" min={0} defaultValue={filters.salary ?? ""} />
          </label>
          <div className="stack">
            {FACILITIES.map((facility) => (
              <label key={facility.id} className="check">
                <input type="checkbox" name="facility" value={facility.id} defaultChecked={filters.facilities.includes(facility.id)} />
                {facility.label}
              </label>
            ))}
          </div>
          <button className="btn" type="submit">
            Terapkan filter
          </button>
          <Link className="btn secondary" href="/search">
            Reset
          </Link>
          <button className="btn secondary" type="button" onClick={() => void loadIsochrone(filters.maxMinutes ?? 20, setIsochrone, setStatus)}>
            Area waktu tempuh
          </button>
          {status ? <span className="status">{status}</span> : null}
        </form>

        <div className="stack">
          <label className="field">
            <span>Cari kos</span>
            <input
              type="search"
              value={query}
              placeholder="Ketik nama kos. Kartu dan peta langsung ke sana."
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="row">
              <strong>{visible.length} kos</strong>
              <span className="muted">
                {excludedIncomplete > 0 ? `· ${excludedIncomplete} belum lengkap ` : ""}
                {outsideArea > 0 && focusKm ? `· ${outsideArea} di luar ${focusKm} km` : ""}
              </span>
            </div>
            <div className="row">
              <label className="row" style={{ gap: "0.35rem", fontSize: "0.88rem" }}>
                <span className="muted">Urutkan:</span>
                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(
                      event.target.value as
                        | "distance_asc"
                        | "duration_asc"
                        | "price_asc"
                        | "price_desc"
                        | "score_desc"
                        | "name_asc",
                    )
                  }
                  style={{ width: "auto", padding: "0.45rem 0.7rem", fontSize: "0.88rem" }}
                >
                  <option value="distance_asc">Terdekat dari lokasi acuan</option>
                  <option value="duration_asc">Waktu tempuh tercepat</option>
                  <option value="price_asc">Harga termurah</option>
                  <option value="price_desc">Harga tertinggi</option>
                  <option value="score_desc">Skor tertinggi</option>
                  <option value="name_asc">Nama A–Z</option>
                </select>
              </label>
              <button
                className="btn secondary"
                type="button"
                disabled={nearest.length === 0}
                onClick={copyNearestLinks}
              >
                Salin tautan {nearest.length} terdekat
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={nearest.length < 2}
                onClick={() => router.push(`/compare?ids=${nearest.map((item) => item.listing.id).join(",")}`)}
              >
                Bandingkan {nearest.length} terdekat
              </button>
              <button
                className="btn"
                type="button"
                disabled={selected.length < 2}
                onClick={() => router.push(`/compare?ids=${selected.join(",")}`)}
              >
                Bandingkan ({selected.length})
              </button>
            </div>
          </div>
          {radiusIgnored ? <p className="note">Filter radius diabaikan karena kantor belum dipasang.</p> : null}
          <section className="search-map">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Kos terdekat dari {originName}</strong>
              <div className="row">
                <button className="btn secondary" type="button" onClick={() => setMapOpen((open) => !open)}>
                  {mapOpen ? "Sembunyikan peta" : "Tampilkan peta"}
                </button>
                <button className="btn secondary" type="button" onClick={locateMe}>
                  Lokasi saya
                </button>
                {here ? (
                  <button className="btn secondary" type="button" onClick={() => setHere(null)}>
                    Kembali ke {office?.name ?? "kantor"}
                  </button>
                ) : null}
              </div>
            </div>
            {mapOpen || placing ? <div className="search-map-frame">
              <MapCanvas
                className="map-frame map-search"
                showPreview={false}
                shapes={searchShapes}
                fitIds={placing ? ["office-draft", ...mapFitIds.filter((id) => id !== "office" && id !== "here")] : mapFitIds}
                fitPath={clickedPath?.coordinates ?? null}
                focusId={activeId}
                markers={
                  placing
                    ? [
                        {
                          id: "office-draft",
                          latitude: officeDraft.latitude,
                          longitude: officeDraft.longitude,
                          label: officeDraft.name,
                          tone: "office",
                        },
                        ...shownMarkers.filter((marker) => marker.id !== "office" && marker.id !== "here"),
                      ]
                    : shownMarkers
                }
                onSelect={(id) => {
                  if (id === "office" || id === "here" || id === "office-draft") return;
                  chooseListing(id);
                }}
                onPick={
                  placing
                    ? (coords) => setOfficeDraft({ ...officeDraft, latitude: coords.latitude, longitude: coords.longitude })
                    : undefined
                }
              />
              {nearest.length > 0 ? (
                <ol className="nearest-list" style={{ maxHeight: "calc(100% - 1.3rem)", overflow: "auto", width: "min(230px, 46%)" }}>
                  {nearest.map((item, index) => (
                    <li key={item.listing.id}>
                      <button
                        type="button"
                        data-active={active?.id === item.listing.id}
                        onClick={() => chooseListing(item.listing.id)}
                      >
                        <strong>{index + 1}</strong>
                        <span>
                          {item.listing.name}
                          <em>{formatKm(item.km)}</em>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div> : null}
          </section>
          {visible.length === 0 ? (
            <p className="card card-pad muted">
              {sources.length === 0
                ? "Centang Rukita atau Mamikos untuk menampilkan kos."
                : query.trim()
                  ? `Tidak ada kos yang cocok dengan “${query.trim()}”.`
                  : genders.length > 0
                  ? `Tidak ada kos ${genders.map((gender) => genderLabel(gender).toLowerCase()).join(" atau ")} di sumber yang dicentang.`
                  : outsideArea > 0
                    ? "Kos yang cocok semuanya berada di luar jangkauan lokasi acuan."
                    : "Tidak ada kos yang lolos filter."}
            </p>
          ) : (
            <div className="kos-grid">
              {visible.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  active={active?.id === listing.id}
                  checked={selected.includes(listing.id)}
                  onOpen={() => chooseListing(listing.id)}
                  onToggle={() => toggle(listing.id)}
                  score={scores[listing.id]?.overall ?? null}
                  distanceKm={pointKm(listing)}
                  originName={originName}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="card card-pad stack board-detail">
          <ListingDetail
            listing={active}
            score={active ? (scores[active.id]?.overall ?? null) : null}
            warnings={active ? (warnings[active.id] ?? []) : []}
            salary={filters.salary}
            distanceKm={active ? pointKm(active) : null}
            originName={originName}
            originPoint={originPoint}
          />
        </aside>
      </section>
    </div>
  );
}

function GenderBadge({
  listing,
}: {
  listing: { gender: string; name: string; sourceUrl: string | null; description: string | null };
}) {
  const gender = displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description);
  return (
    <span className="badge gender" data-gender={gender}>
      {genderLabel(gender)}
    </span>
  );
}

function ListingCard({
  listing,
  active,
  checked,
  onOpen,
  onToggle,
  score,
  distanceKm,
  originName,
}: {
  listing: ListingWithCommute;
  active: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggle: () => void;
  score: number | null;
  distanceKm: number | null;
  originName: string;
}) {
  return (
    <article className="kos-card" data-active={active} onClick={onOpen}>
      {listing.imageUrls[0] ? <img src={listing.imageUrls[0]} alt="" /> : null}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="row">
          <SourceBadge sourceName={listing.sourceName} sourceUrl={listing.sourceUrl} />
          <GenderBadge listing={listing} />
        </span>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Pilih ${listing.name}`}
          onClick={(event) => event.stopPropagation()}
          onChange={onToggle}
        />
      </div>
      <h2>{listing.name}</h2>
      <p className="muted">{listing.address ?? "Alamat belum ada"}</p>
      <strong>
        {formatIdr(listing.priceAmount)}
        {listing.isStartingPrice ? " · mulai" : ""}
      </strong>
      <p className="muted">
        {formatKm(distanceKm)} {originName === "lokasi saya" || listing.routeStatus !== "ready" ? "garis lurus" : "lewat jalan"} dari {originName}
        {originName === "lokasi saya" ? "" : ` · ${commuteLabel(listing.routeStatus, listing.durationSeconds)}`}
        {score != null ? ` · skor ${score}` : ""}
      </p>
    </article>
  );
}

function ListingDetail({
  listing,
  score,
  warnings,
  salary,
  distanceKm,
  originName,
  originPoint,
}: {
  listing: ListingWithCommute | null;
  score: number | null;
  warnings: string[];
  salary: number | null;
  distanceKm: number | null;
  originName: string;
  originPoint: { latitude: number; longitude: number } | null;
}) {
  if (!listing) {
    return (
      <div className="stack">
        <h2>Detail kos</h2>
        <p className="muted">Pilih satu kartu untuk melihat harga, jarak, dan tautan aslinya.</p>
      </div>
    );
  }
  const ratio = salary && listing.priceAmount ? listing.priceAmount / salary : null;
  return (
    <div className="stack">
      <h2>Detail kos</h2>
      {listing.imageUrls[0] ? <img className="cover" src={listing.imageUrls[0]} alt="" /> : null}
      <span className="row">
        <SourceBadge sourceName={listing.sourceName} sourceUrl={listing.sourceUrl} />
        <GenderBadge listing={listing} />
      </span>
      <h3>{listing.name}</h3>
      <p>
        {formatIdr(listing.priceAmount)} · {genderLabel(displayGender(listing.gender, listing.name, listing.sourceUrl, listing.description))}
        {listing.isStartingPrice ? " · mulai dari" : ""}
      </p>
      <p className="muted">
        {formatKm(distanceKm)} {originName === "lokasi saya" || listing.routeStatus !== "ready" ? "garis lurus" : "lewat jalan"} dari {originName}
        {originName === "lokasi saya" ? "" : ` · ${commuteLabel(listing.routeStatus, listing.durationSeconds)}`} ·{" "}
        {locationQualityLabel(listing.locationQuality)}
      </p>
      <p className="muted">
        {listing.latitude != null && listing.longitude != null
          ? `Koordinat ${listing.latitude.toFixed(5)}, ${listing.longitude.toFixed(5)}`
          : "Koordinat belum terbaca, jaraknya belum akurat."}
      </p>
      <CopyMapsRoute
        from={originPoint}
        to={listing.latitude != null && listing.longitude != null ? { latitude: listing.latitude, longitude: listing.longitude } : null}
      />
      <div className="row">
        {listing.facilities.map((id) => (
          <span key={id} className="badge">
            {facilityLabel(id)}
          </span>
        ))}
        <span className="badge clay">Data {formatPercent(listing.completeness)}</span>
        {score != null ? <span className="badge">Skor {score}</span> : null}
        {ratio != null ? <span className={`badge ${ratio > 0.3 ? "warn" : ""}`}>Sewa {Math.round(ratio * 100)}% gaji</span> : null}
        {listing.availability === "full" ? <span className="badge warn">{availabilityLabel(listing.availability)}</span> : null}
      </div>
      {warnings.length > 0 ? <p className="muted">{warnings.join(" · ")}</p> : null}
      <div className="row">
        <SourceLink url={listing.sourceUrl} />
        <Link className="btn" href={`/listings/${listing.id}`}>
          Selengkapnya
        </Link>
      </div>
    </div>
  );
}

function mapShapes(office: OfficeView | null, radiusKm: number | null, isochrone: MapShape["geojson"] | null): MapShape[] {
  const shapes: MapShape[] = [];
  if (office && radiusKm) {
    shapes.push({
      id: "radius",
      color: "#1e4638",
      geojson: circlePolygon(office.latitude, office.longitude, radiusKm),
    });
  }
  if (isochrone) shapes.push({ id: "isochrone", color: "#b8612f", geojson: isochrone });
  return shapes;
}

async function loadIsochrone(
  minutes: number,
  setShape: (shape: MapShape["geojson"] | null) => void,
  setStatus: (value: string) => void,
) {
  setStatus("Menghitung area waktu tempuh…");
  const response = await fetch("/api/isochrone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ minutes: Math.min(60, Math.max(5, Math.round(minutes))) }),
  });
  const body = await response.json();
  if (!response.ok) {
    setStatus(body.error ?? "Area waktu tempuh gagal.");
    return;
  }
  setShape(body.polygon);
  setStatus(body.note ?? "Area waktu tempuh diperbarui.");
}
