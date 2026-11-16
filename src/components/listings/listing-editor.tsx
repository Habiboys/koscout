"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deduplicateImages, parseDetailMeta } from "@/lib/detail-meta";
import { facilityLabel } from "@/lib/facilities";
import { commuteLabel, formatIdr, formatKm, formatWhen } from "@/lib/format";
import { availabilityLabel, genderLabel } from "@/lib/labels";
import { streetViewUrl, whatsappMessage } from "@/lib/listing-tools";
import { describeSource } from "@/lib/sources";
import { monthlyCost, transportMonthlyCost } from "@/server/cost/monthly-cost";
import type { NearbyReport } from "@/server/nearby/overpass";
import type { ListingWithCommute } from "@/server/listings";
import { SourceBadge } from "@/components/listings/source-badge";
import { CopyMapsRoute } from "@/components/maps/copy-maps-route";

const STATUSES = [
  ["saved", "Tersimpan"],
  ["contacted", "Sudah dihubungi"],
  ["survey_scheduled", "Jadwal survei"],
  ["surveyed", "Sudah survei"],
  ["chosen", "Dipilih"],
  ["rejected", "Ditolak"],
] as const;

const CHECKS = [
  ["kamar", "Kamar"],
  ["kamar_mandi", "Kamar mandi"],
  ["ventilasi", "Ventilasi"],
  ["kebisingan", "Kebisingan"],
  ["keamanan", "Keamanan"],
  ["sinyal", "Sinyal"],
  ["parkir", "Parkir"],
] as const;

const GRADES = ["belum", "baik", "cukup", "buruk"] as const;

export function ListingEditor({
  listing,
  officeName,
  officePoint = null,
  favorite,
  visit,
  nearby,
}: {
  listing: ListingWithCommute;
  officeName: string | null;
  officePoint?: { latitude: number; longitude: number } | null;
  favorite?: { status: string; note: string | null } | null;
  visit?: { checks: Record<string, string>; note: string | null; photoUrls: string[] } | null;
  nearby?: NearbyReport | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(listing);
  const [syncing, setSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [favStatus, setFavStatus] = useState(favorite?.status ?? "saved");
  const [favNote, setFavNote] = useState(favorite?.note ?? "");
  const [nearbyReport, setNearbyReport] = useState<NearbyReport | null>(nearby ?? null);
  const [modes, setModes] = useState<Array<{ label: string; detail: string }>>([]);
  const [showCostEdit, setShowCostEdit] = useState(false);
  const [showSurveyEdit, setShowSurveyEdit] = useState(false);

  const [costs, setCosts] = useState({
    roomSizeM2: listing.roomSizeM2,
    depositAmount: listing.depositAmount,
    adminFee: listing.adminFee,
    movingFee: listing.movingFee,
    electricityStatus: listing.electricityStatus,
    electricityMonthly: listing.electricityMonthly,
    internetStatus: listing.facilities.includes("wifi") ? "included" : listing.internetStatus,
    internetMonthly: listing.internetMonthly,
    laundryMonthly: listing.laundryMonthly,
    otherMonthly: listing.otherMonthly,
  });

  const [checks, setChecks] = useState<Record<string, "baik" | "cukup" | "buruk" | "belum">>(() => {
    const initial: Record<string, "baik" | "cukup" | "buruk" | "belum"> = {};
    for (const [id] of CHECKS) {
      const value = visit?.checks[id];
      initial[id] = value === "baik" || value === "cukup" || value === "buruk" ? value : "belum";
    }
    return initial;
  });
  const [visitNote, setVisitNote] = useState(visit?.note ?? "");

  const meta = useMemo(() => parseDetailMeta(current.rawText), [current.rawText]);
  const photos = useMemo(() => deduplicateImages(current.imageUrls).slice(0, 5), [current.imageUrls]);
  const sourceDisplay = describeSource(current.sourceName, current.sourceUrl).label;

  const specItems = useMemo(() => {
    if (meta?.specItems && meta.specItems.length > 0) return meta.specItems;
    const fallback: string[] = [];
    if (costs.roomSizeM2) fallback.push(`${costs.roomSizeM2} m²`);
    if (costs.electricityStatus === "included") fallback.push("Termasuk listrik");
    else if (costs.electricityStatus === "excluded") fallback.push("Tidak termasuk listrik");
    if (costs.depositAmount) fallback.push(`Deposit ${formatIdr(costs.depositAmount)}`);
    return fallback.length > 0 ? fallback : ["Ukuran kamar sesuai tipe", "Cek ketentuan listrik di situs asli"];
  }, [costs.depositAmount, costs.electricityStatus, costs.roomSizeM2, meta?.specItems]);

  const roomFacs = useMemo(() => {
    if (meta?.roomFacilities && meta.roomFacilities.length > 0) return meta.roomFacilities;
    const base = current.facilities
      .filter((id) => id === "ac" || id === "wifi")
      .map((id) => facilityLabel(id));
    return base.length > 0 ? base : ["Kasur", "Lemari / Storage", "Meja", "Ventilasi", "Jendela"];
  }, [current.facilities, meta?.roomFacilities]);

  const bathFacs = useMemo(() => {
    if (meta?.bathFacilities && meta.bathFacilities.length > 0) return meta.bathFacilities;
    const base = current.facilities
      .filter((id) => id === "private_bathroom" || id === "shared_bathroom")
      .map((id) => facilityLabel(id));
    return base.length > 0 ? base : ["Kamar mandi sesuai tipe kamar"];
  }, [current.facilities, meta?.bathFacilities]);

  const sharedFacs = useMemo(() => {
    const combined = [
      ...(meta?.sharedFacilities ?? []),
      ...(meta?.parkingFacilities ?? []),
      ...current.facilities
        .filter((id) => id === "wifi" || id === "motorcycle_parking" || id === "kitchen")
        .map((id) => facilityLabel(id)),
    ];
    return [...new Set(combined)];
  }, [current.facilities, meta?.parkingFacilities, meta?.sharedFacilities]);

  const rules = useMemo(() => {
    if (meta?.rules && meta.rules.length > 0) return meta.rules;
    const out = ["Akses 24 jam", "Calon penyewa wajib sertakan KTP"];
    if (current.gender === "putri") out.unshift("Khusus penghuni putri");
    else if (current.gender === "putra") out.unshift("Khusus penghuni putra");
    else if (current.gender === "campur") out.unshift("Kos campur");
    return out;
  }, [current.gender, meta?.rules]);

  const storyText = meta?.ownerStory ?? current.description;
  const transportMotor = transportMonthlyCost(current.distanceKm, "motorcycle");
  const costSummary = useMemo(
    () =>
      monthlyCost({
        rent: current.priceAmount,
        electricityStatus: costs.electricityStatus,
        electricityMonthly: costs.electricityMonthly,
        internetStatus: costs.internetStatus,
        internetMonthly: costs.internetMonthly,
        laundryMonthly: costs.laundryMonthly,
        otherMonthly: costs.otherMonthly,
        transportMonthly: transportMotor,
        depositAmount: costs.depositAmount,
        adminFee: costs.adminFee,
        movingFee: costs.movingFee,
      }),
    [costs, current.priceAmount, transportMotor],
  );
  const pricePerM2 =
    current.priceAmount != null && costs.roomSizeM2 != null && costs.roomSizeM2 > 0
      ? Math.round(current.priceAmount / costs.roomSizeM2)
      : null;

  const waHref = `https://wa.me/?text=${encodeURIComponent(
    whatsappMessage({
      name: current.name,
      priceAmount: current.priceAmount,
      electricityStatus: costs.electricityStatus,
      internetStatus: costs.internetStatus,
      depositAmount: costs.depositAmount,
      roomSizeM2: costs.roomSizeM2,
      availability: current.availability,
      gender: current.gender,
    }),
  )}`;

  async function refreshFromSource() {
    setSyncing(true);
    setStatusMsg("Mengambil detail terbaru dari situs asli…");
    const response = await fetch(`/api/listings/${current.id}/refresh`, { method: "POST" });
    const data = (await response.json()) as { record?: ListingWithCommute; error?: string };
    setSyncing(false);
    if (!response.ok || !data.record) {
      setStatusMsg(data.error ?? "Gagal membaca halaman sumber.");
      return;
    }
    setCurrent({ ...current, ...data.record });
    setCosts((prev) => ({
      ...prev,
      roomSizeM2: data.record?.roomSizeM2 ?? prev.roomSizeM2,
      depositAmount: data.record?.depositAmount ?? prev.depositAmount,
      electricityStatus: data.record?.electricityStatus ?? prev.electricityStatus,
    }));
    setStatusMsg("Detail berhasil diperbarui dari situs asli.");
    router.refresh();
  }

  async function saveFavorite() {
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: current.id, status: favStatus, note: favNote }),
    });
    setStatusMsg(response.ok ? "Status favorit tersimpan." : "Gagal menyimpan favorit.");
    router.refresh();
  }

  async function saveCosts() {
    const response = await fetch(`/api/listings/${current.id}/costs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costs),
    });
    setStatusMsg(response.ok ? "Simulasi biaya tersimpan." : "Gagal menyimpan biaya.");
    setShowCostEdit(false);
    router.refresh();
  }

  async function saveVisit() {
    const response = await fetch(`/api/listings/${current.id}/visit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checks, note: visitNote, photoUrls: [] }),
    });
    setStatusMsg(response.ok ? "Checklist survei tersimpan." : "Gagal menyimpan survei.");
    setShowSurveyEdit(false);
  }

  async function loadNearby() {
    setStatusMsg("Mengambil fasilitas sekitar dari OpenStreetMap…");
    const response = await fetch(`/api/listings/${current.id}/nearby`, { method: "POST" });
    const body = (await response.json()) as { report?: NearbyReport; error?: string };
    if (!response.ok || !body.report) {
      setStatusMsg(body.error ?? "Fasilitas sekitar gagal dihitung.");
      return;
    }
    setNearbyReport(body.report);
    setStatusMsg("Fasilitas sekitar berhasil dimuat.");
  }

  async function loadModes() {
    setStatusMsg("Menghitung perbandingan waktu tempuh…");
    const profiles = [
      ["foot", "Jalan kaki"],
      ["bike", "Sepeda"],
      ["driving", "Motor / mobil"],
    ] as const;
    const rows: Array<{ label: string; detail: string }> = [];
    for (const [profile, label] of profiles) {
      const response = await fetch(`/api/listings/${current.id}/route?profile=${profile}`);
      const body = (await response.json()) as { durationSeconds?: number; distanceMeters?: number };
      if (!response.ok || body.durationSeconds == null || body.distanceMeters == null) continue;
      rows.push({
        label,
        detail: `${Math.max(1, Math.round(body.durationSeconds / 60))} menit · ${(body.distanceMeters / 1000).toFixed(1)} km`,
      });
    }
    setModes(rows);
    setStatusMsg("Perbandingan moda siap.");
  }

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <style>{`
        .mk-tabs {
          position: sticky;
          top: 0;
          z-index: 15;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.65rem 1.25rem;
          background: rgba(255, 255, 255, 0.96);
          backdrop-filter: blur(8px);
          border: 1px solid #e3d8c8;
          border-radius: 0.9rem;
        }
        .mk-tab-links {
          display: flex;
          gap: 1.5rem;
          overflow-x: auto;
        }
        .mk-tab-links a {
          padding: 0.4rem 0;
          font-size: 0.92rem;
          font-weight: 600;
          color: #555;
          white-space: nowrap;
          border-bottom: 2.5px solid transparent;
        }
        .mk-tab-links a:hover,
        .mk-tab-links a.active {
          color: #1baa56;
          border-bottom-color: #1baa56;
        }
        .mk-gallery {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          grid-template-rows: 195px 195px;
          gap: 0.5rem;
          border-radius: 1.1rem;
          overflow: hidden;
        }
        .mk-gallery[data-count="1"] {
          grid-template-columns: 1fr;
          grid-template-rows: 360px;
        }
        .mk-gallery[data-count="2"] {
          grid-template-columns: 1.4fr 1fr;
          grid-template-rows: 340px;
        }
        .mk-gallery[data-count="3"] {
          grid-template-columns: 1.6fr 1fr;
          grid-template-rows: 175px 175px;
        }
        .mk-photo {
          display: block;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: #eae3d7;
        }
        .mk-photo.hero {
          grid-row: 1 / -1;
        }
        .mk-photo img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .mk-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 380px;
          gap: 2rem;
          align-items: start;
        }
        .mk-main {
          background: #ffffff;
          border: 1px solid #e3d8c8;
          border-radius: 1.15rem;
          padding: 1.6rem 1.85rem;
          box-shadow: 0 12px 32px rgba(48, 32, 16, 0.06);
        }
        .mk-sec {
          padding: 1.35rem 0;
          border-top: 1px solid #ece6dc;
          display: grid;
          gap: 0.9rem;
        }
        .mk-sec:first-child {
          padding-top: 0;
          border-top: 0;
        }
        .mk-sec h2 {
          font-family: var(--font-body), "Segoe UI", sans-serif;
          font-size: 1.18rem;
          font-weight: 700;
          color: #222;
          margin: 0;
        }
        .mk-grid2 {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.85rem 1.5rem;
        }
        .mk-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
          color: #333;
        }
        .mk-sidebar {
          position: sticky;
          top: 4.5rem;
          display: grid;
          gap: 1rem;
        }
        .mk-price-card {
          background: #ffffff;
          border: 1px solid #e3d8c8;
          border-radius: 1.1rem;
          padding: 1.4rem;
          box-shadow: 0 10px 28px rgba(24, 24, 24, 0.08);
          display: grid;
          gap: 1rem;
        }
        @media (max-width: 960px) {
          .mk-layout {
            grid-template-columns: 1fr;
          }
          .mk-sidebar {
            position: static;
          }
          .mk-grid2 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <nav className="mk-tabs" aria-label="Navigasi bagian kos">
        <div className="mk-tab-links">
          <a href="#foto-properti" className="active">
            Foto Properti
          </a>
          <a href="#fasilitas-kamar">Fasilitas Kamar</a>
          <a href="#fasilitas-umum">Fasilitas Umum</a>
          <a href="#peraturan">Peraturan</a>
          <a href="#lokasi">Lokasi</a>
          <a href="#ringkasan-biaya">Biaya & Survei</a>
          <a href="#pemilik-kos">Pemilik Kos</a>
        </div>
        <Link className="btn secondary" href="/search" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
          ← Kembali ke Cari
        </Link>
      </nav>

      {photos.length > 0 ? (
        <section id="foto-properti" className="mk-gallery" data-count={Math.min(photos.length, 4)}>
          {photos.map((url, idx) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className={`mk-photo ${idx === 0 ? "hero" : ""}`}>
              <img src={url} alt={`${current.name} - foto ${idx + 1}`} />
            </a>
          ))}
        </section>
      ) : null}

      <div className="mk-layout">
        <div className="mk-main">
          <section className="mk-sec">
            <div className="row" style={{ gap: "0.5rem" }}>
              <SourceBadge sourceName={current.sourceName} sourceUrl={current.sourceUrl} />
              {meta?.brandBadge ? <span className="badge clay">{meta.brandBadge}</span> : null}
              <span
                style={{
                  display: "inline-flex",
                  padding: "0.2rem 0.65rem",
                  border: "1px solid #d4cfc7",
                  borderRadius: "0.4rem",
                  fontSize: "0.83rem",
                  fontWeight: 600,
                  color: "#333",
                }}
              >
                Kos {genderLabel(current.gender)}
              </span>
              {meta?.rating != null ? (
                <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
                  · {meta.rating.toLocaleString("id-ID")}
                  {meta.reviewCount != null ? ` (${meta.reviewCount} review)` : ""}
                </span>
              ) : null}
              {meta?.transactionLabel ? (
                <span className="muted" style={{ fontSize: "0.9rem" }}>
                  · {meta.transactionLabel}
                </span>
              ) : null}
              {meta?.availableRoomsCount != null ? (
                <span
                  style={{
                    color: meta.availableRoomsCount <= 3 ? "#d9381e" : "#1baa56",
                    fontWeight: 700,
                    fontSize: "0.9rem",
                  }}
                >
                  · Tersisa {meta.availableRoomsCount} kamar
                </span>
              ) : (
                <span style={{ color: "#1baa56", fontWeight: 700, fontSize: "0.9rem" }}>
                  · {availabilityLabel(current.availability)}
                </span>
              )}
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-body), "Segoe UI", sans-serif',
                fontSize: "1.55rem",
                fontWeight: 700,
                lineHeight: 1.3,
                color: "#1e1e1e",
                margin: 0,
              }}
            >
              {current.name}
            </h1>

            <p className="muted" style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
              <IconPin />
              <span>{current.address ?? "Bandung"}</span>
              {officeName ? (
                <span>
                  · <strong>{formatKm(current.distanceKm)}</strong>
                  {current.routeStatus === "ready" ? " lewat jalan" : " garis lurus"} (
                  {commuteLabel(current.routeStatus, current.durationSeconds)} ke {officeName})
                </span>
              ) : null}
            </p>

            <div
              id="pemilik-kos"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                paddingTop: "1rem",
                borderTop: "1px dashed #dcd4c8",
              }}
            >
              <div>
                <strong style={{ fontSize: "1rem", color: "#222" }}>
                  {meta?.ownerName ?? `Dikelola melalui ${sourceDisplay}`}
                </strong>
                <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.85rem" }}>
                  {meta?.ownerStatus ?? `Dicek ${formatWhen(current.lastCheckedAt)}`}
                </p>
              </div>
              {meta?.ownerPhotoUrl ? (
                <img
                  src={meta.ownerPhotoUrl}
                  alt="Pemilik kos"
                  style={{ width: 48, height: 48, borderRadius: 999, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 999,
                    background: "#e7f0ea",
                    color: "#145c3a",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                  }}
                >
                  {(meta?.ownerName ?? sourceDisplay).slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
          </section>

          <section className="mk-sec">
            <h2>Spesifikasi tipe kamar</h2>
            <div className="mk-grid2">
              {specItems.map((item) => (
                <div key={item} className="mk-item">
                  <FacilityIcon label={item} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="fasilitas-kamar" className="mk-sec">
            <h2>Fasilitas kamar</h2>
            <div className="mk-grid2">
              {roomFacs.map((item) => (
                <div key={item} className="mk-item">
                  <FacilityIcon label={item} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="mk-sec">
            <h2>Fasilitas kamar mandi</h2>
            <div className="mk-grid2">
              {bathFacs.map((item) => (
                <div key={item} className="mk-item">
                  <FacilityIcon label={item} />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {sharedFacs.length > 0 || meta?.facilityNote || current.extraFeesNote ? (
            <section id="fasilitas-umum" className="mk-sec">
              <h2>Fasilitas umum</h2>
              {sharedFacs.length > 0 ? (
                <div className="mk-grid2">
                  {sharedFacs.map((item) => (
                    <div key={item} className="mk-item">
                      <FacilityIcon label={item} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {meta?.facilityNote || current.extraFeesNote ? (
                <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                  <strong>Catatan tambahan seputar fasilitas:</strong> {meta?.facilityNote ?? current.extraFeesNote}
                </p>
              ) : null}
            </section>
          ) : null}

          {meta?.refundNote ? (
            <section className="mk-sec">
              <h2>Ketentuan refund</h2>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{meta.refundNote}</p>
            </section>
          ) : null}

          <section id="peraturan" className="mk-sec">
            <h2>Peraturan kos</h2>
            <div className="mk-grid2">
              {rules.map((rule) => (
                <div key={rule} className="mk-item">
                  <FacilityIcon label={rule} />
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </section>

          {meta?.roomTypes && meta.roomTypes.length > 0 ? (
            <section className="mk-sec">
              <h2>Pilihan tipe kamar di gedung ini</h2>
              <div className="stack">
                {meta.roomTypes.map((rt) => (
                  <div
                    key={rt.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                      padding: "0.95rem 1.1rem",
                      border: "1px solid #e5dfd5",
                      borderRadius: "0.85rem",
                      background: "#fcfaf7",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1rem" }}>{rt.name}</strong>
                      <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.86rem" }}>
                        {[rt.sizeLabel, ...rt.facilities.slice(0, 4)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {rt.priceRaw ? <strong style={{ color: "#1e1e1e" }}>{rt.priceRaw}</strong> : null}
                      {rt.availability ? (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: /penuh/i.test(rt.availability) ? "#8d2f2f" : "#1baa56",
                            fontWeight: 600,
                          }}
                        >
                          {rt.availability}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {storyText ? (
            <section className="mk-sec">
              <h2>Cerita pemilik tentang kos ini</h2>
              <p style={{ margin: 0, lineHeight: 1.65, whiteSpace: "pre-line", color: "#333" }}>{storyText}</p>
            </section>
          ) : null}

          {meta?.reviews && meta.reviews.length > 0 ? (
            <section className="mk-sec">
              <h2>
                Review penghuni
                {meta.rating != null ? ` · ${meta.rating.toLocaleString("id-ID")}` : ""}
                {meta.reviewCount != null ? ` (${meta.reviewCount})` : ""}
              </h2>
              {meta.ratingParts && meta.ratingParts.length > 0 ? (
                <div className="mk-grid2">
                  {meta.ratingParts.map((part) => (
                    <div key={part.label} className="mk-item">
                      <span>
                        {part.label}: {part.score.toLocaleString("id-ID")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="stack">
                {meta.reviews.map((review) => (
                  <div key={`${review.author}-${review.ago ?? ""}`} className="mk-item" style={{ alignItems: "flex-start" }}>
                    <div>
                      <strong>
                        {review.author}
                        {review.rating != null ? ` · ${review.rating.toLocaleString("id-ID")}` : ""}
                      </strong>
                      {review.ago ? <p className="muted" style={{ margin: "0.15rem 0 0" }}>{review.ago}</p> : null}
                      {review.text ? <p style={{ margin: "0.35rem 0 0", lineHeight: 1.55 }}>{review.text}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section id="lokasi" className="mk-sec">
            <h2>Lokasi & akses lingkungan</h2>
            <p style={{ margin: 0, color: "#333" }}>
              <strong>Alamat:</strong> {current.address ?? "Bandung"}
            </p>
            <p className="muted" style={{ margin: 0 }}>
              {current.latitude != null && current.longitude != null
                ? `Koordinat ${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}. Jarak memakai titik ini.`
                : "Koordinat belum terbaca, jarak belum bisa dihitung akurat."}
            </p>
            {officeName ? (
              <p className="muted" style={{ margin: 0 }}>
                Jarak ke <strong>{officeName}</strong>: <strong>{formatKm(current.distanceKm)}</strong>
                {current.routeStatus === "ready" ? " lewat jalan" : " garis lurus"} · waktu tempuh berkendara{" "}
                <strong>{commuteLabel(current.routeStatus, current.durationSeconds)}</strong>.
              </p>
            ) : null}
            <CopyMapsRoute
              from={officePoint}
              to={
                current.latitude != null && current.longitude != null
                  ? { latitude: current.latitude, longitude: current.longitude }
                  : null
              }
            />
            {meta?.nearbyPois && meta.nearbyPois.length > 0 ? (
              <div className="mk-grid2">
                {meta.nearbyPois.map((poi) => (
                  <div key={poi} className="mk-item">
                    <IconPin />
                    <span>{poi}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {nearbyReport ? (
              <div className="mk-grid2">
                {nearbyReport.categories.map((cat) => (
                  <div key={cat.id} className="mk-item">
                    <IconPin />
                    <span>
                      {cat.label}: {cat.count} titik{cat.nearestMeters != null ? ` (terdekat ${cat.nearestMeters} m)` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {modes.length > 0 ? (
              <div className="row">
                {modes.map((m) => (
                  <span key={m.label} className="badge">
                    {m.label}: {m.detail}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="row">
              <button className="btn secondary" type="button" onClick={() => void loadNearby()}>
                Cek fasilitas sekitar (OSM)
              </button>
              <button className="btn secondary" type="button" onClick={() => void loadModes()}>
                Bandingkan jalan kaki / sepeda / motor
              </button>
              {current.latitude != null && current.longitude != null ? (
                <>
                  <a
                    className="btn secondary"
                    href={`https://www.google.com/maps/search/?api=1&query=${current.latitude},${current.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Maps
                  </a>
                  <a className="btn secondary" href={streetViewUrl(current.latitude, current.longitude)} target="_blank" rel="noreferrer">
                    Street View
                  </a>
                </>
              ) : null}
            </div>
          </section>

          {/* Gabungan 1 Card Ringkas untuk Biaya Bulanan, Favorit & Checklist Survei */}
          <section id="ringkasan-biaya" className="mk-sec">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2>Ringkasan Biaya Bulanan, Favorit & Catatan Survei</h2>
              <div className="row">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setShowCostEdit((v) => !v)}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                >
                  {showCostEdit ? "Tutup rincian biaya" : "Atur komponen biaya"}
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setShowSurveyEdit((v) => !v)}
                  style={{ padding: "0.35rem 0.75rem", fontSize: "0.82rem" }}
                >
                  {showSurveyEdit ? "Tutup checklist survei" : "Checklist survei kamar"}
                </button>
              </div>
            </div>

            <div className="mk-grid2">
              <div className="mk-item">
                <FacilityIcon label="meter" />
                <span>
                  Luas kamar: <strong>{costs.roomSizeM2 ? `${costs.roomSizeM2} m²` : "Sesuai tipe"}</strong>
                  {pricePerM2 ? ` (${formatIdr(pricePerM2)}/m²)` : ""}
                </span>
              </div>
              <div className="mk-item">
                <FacilityIcon label="listrik" />
                <span>
                  Listrik:{" "}
                  <strong>
                    {costs.electricityStatus === "included"
                      ? "Termasuk sewa"
                      : costs.electricityStatus === "excluded"
                        ? costs.electricityMonthly
                          ? formatIdr(costs.electricityMonthly)
                          : "Bayar sendiri"
                        : "Belum diketahui"}
                  </strong>
                </span>
              </div>
              <div className="mk-item">
                <FacilityIcon label="wifi" />
                <span>
                  Internet / Wi-Fi:{" "}
                  <strong>
                    {costs.internetStatus === "included"
                      ? "Termasuk sewa"
                      : costs.internetMonthly
                        ? formatIdr(costs.internetMonthly)
                        : "Belum diketahui"}
                  </strong>
                </span>
              </div>
              <div className="mk-item">
                <FacilityIcon label="parkir" />
                <span>
                  Estimasi bensin motor PP ({formatKm(current.distanceKm)}, 22 hr): <strong>{formatIdr(transportMotor)}/bln</strong>
                </span>
              </div>
            </div>

            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Total bulanan: <strong>{formatIdr(costSummary.monthly)}</strong> · Biaya awal:{" "}
              <strong>{formatIdr(costSummary.upfront)}</strong> · Proyeksi{" "}
              {costSummary.projections.map((item) => `${item.months} bln ${formatIdr(item.total)}`).join(" · ")}
            </p>

            {showCostEdit ? (
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid #e5dfd5",
                  borderRadius: "0.85rem",
                  background: "#fcfaf7",
                  display: "grid",
                  gap: "0.75rem",
                }}
              >
                <div className="field-grid">
                  <label className="field">
                    <span>Luas m²</span>
                    <input
                      type="number"
                      value={costs.roomSizeM2 ?? ""}
                      onChange={(e) => setCosts({ ...costs, roomSizeM2: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label className="field">
                    <span>Deposit (Rp)</span>
                    <input
                      type="number"
                      value={costs.depositAmount ?? ""}
                      onChange={(e) => setCosts({ ...costs, depositAmount: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                  <label className="field">
                    <span>Listrik</span>
                    <select
                      value={costs.electricityStatus}
                      onChange={(e) => setCosts({ ...costs, electricityStatus: e.target.value })}
                    >
                      <option value="unknown">Belum diketahui</option>
                      <option value="included">Termasuk sewa</option>
                      <option value="excluded">Bayar sendiri</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Laundry / bulan (Rp)</span>
                    <input
                      type="number"
                      value={costs.laundryMonthly ?? ""}
                      onChange={(e) => setCosts({ ...costs, laundryMonthly: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                </div>
                <div className="row">
                  <button className="btn" type="button" onClick={() => void saveCosts()}>
                    Simpan komponen biaya
                  </button>
                </div>
              </div>
            ) : null}

            {showSurveyEdit ? (
              <div
                style={{
                  padding: "1rem",
                  border: "1px solid #e5dfd5",
                  borderRadius: "0.85rem",
                  background: "#fcfaf7",
                  display: "grid",
                  gap: "0.75rem",
                }}
              >
                <div className="field-grid">
                  {CHECKS.map(([id, label]) => (
                    <label key={id} className="field">
                      <span>{label}</span>
                      <select
                        value={checks[id]}
                        onChange={(e) =>
                          setChecks({ ...checks, [id]: e.target.value as "baik" | "cukup" | "buruk" | "belum" })
                        }
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <label className="field">
                  <span>Catatan kunjungan survei</span>
                  <input value={visitNote} onChange={(e) => setVisitNote(e.target.value)} placeholder="Kesan saat survei langsung…" />
                </label>
                <div className="row">
                  <button className="btn" type="button" onClick={() => void saveVisit()}>
                    Simpan hasil survei
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="mk-sidebar">
          <div className="mk-price-card">
            {meta?.discountLabel || meta?.originalPriceRaw ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.86rem" }}>
                {meta.discountLabel ? (
                  <span style={{ color: "#d9381e", fontWeight: 700 }}>⚡ {meta.discountLabel}</span>
                ) : null}
                {meta.originalPriceRaw ? (
                  <span style={{ color: "#999", textDecoration: "line-through" }}>{meta.originalPriceRaw}</span>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
              <strong style={{ fontSize: "1.65rem", fontWeight: 800, color: "#1e1e1e" }}>
                {formatIdr(current.priceAmount)}
              </strong>
              <span className="muted" style={{ fontSize: "0.92rem" }}>
                /bulan {current.isStartingPrice ? "(Bulan pertama)" : ""}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div
                style={{
                  border: "1px solid #d8d2c9",
                  borderRadius: "0.5rem",
                  padding: "0.55rem 0.7rem",
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: "0.74rem", color: "#757575" }}>Jarak {officeName ?? "Kantor"}</div>
                <strong style={{ fontSize: "0.86rem", color: "#222" }}>
                  {formatKm(current.distanceKm)} · {commuteLabel(current.routeStatus, current.durationSeconds)}
                </strong>
              </div>
              <div
                style={{
                  border: "1px solid #d8d2c9",
                  borderRadius: "0.5rem",
                  padding: "0.55rem 0.7rem",
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: "0.74rem", color: "#757575" }}>Per Bulan</div>
                <strong style={{ fontSize: "0.86rem", color: "#222" }}>
                  {costs.electricityStatus === "included"
                    ? "Termasuk listrik"
                    : costs.electricityStatus === "excluded"
                      ? "Belum listrik"
                      : "Bulanan"}
                </strong>
              </div>
            </div>

            <div className="stack" style={{ gap: "0.6rem" }}>
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1.5px solid #1baa56",
                  background: "#ffffff",
                  color: "#1baa56",
                  fontWeight: 700,
                  fontSize: "0.95rem",
                }}
              >
                💬 Tanya Pemilik
              </a>

              {current.sourceUrl ? (
                <a
                  href={current.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    width: "100%",
                    padding: "0.8rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1.5px solid #1baa56",
                    background: "#1baa56",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  Lihat Situs Asli ({sourceDisplay}) ↗
                </a>
              ) : (
                <button
                  type="button"
                  disabled={syncing}
                  onClick={() => void refreshFromSource()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    width: "100%",
                    padding: "0.8rem 1rem",
                    borderRadius: "0.5rem",
                    border: "1.5px solid #1baa56",
                    background: "#1baa56",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                  }}
                >
                  {syncing ? "Mencari tautan asli…" : `Buka Situs Asli (${sourceDisplay})`}
                </button>
              )}
            </div>

            <div className="row" style={{ justifyContent: "space-between", paddingTop: "0.2rem" }}>
              <button
                className="btn secondary"
                type="button"
                disabled={syncing}
                onClick={() => void refreshFromSource()}
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
              >
                {syncing ? "Memperbarui…" : "↻ Sinkron ulang detail"}
              </button>
              {current.sourceUrl ? (
                <a
                  href={current.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "0.83rem", fontWeight: 600, color: "#1baa56", textDecoration: "underline" }}
                >
                  Situs asli ↗
                </a>
              ) : null}
            </div>

            {statusMsg ? (
              <p className="status" style={{ margin: 0, fontSize: "0.84rem" }}>
                {statusMsg}
              </p>
            ) : null}
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e3d8c8",
              borderRadius: "0.95rem",
              padding: "1rem 1.15rem",
              boxShadow: "0 4px 16px rgba(24, 24, 24, 0.05)",
              display: "grid",
              gap: "0.55rem",
            }}
          >
            <strong style={{ fontSize: "0.95rem", color: "#222" }}>Simpan ke Favorit & Pipeline</strong>
            <div className="row">
              <select
                value={favStatus}
                onChange={(event) => setFavStatus(event.target.value)}
                style={{ flex: 1, padding: "0.45rem 0.6rem", fontSize: "0.85rem" }}
              >
                {STATUSES.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                className="btn secondary"
                type="button"
                onClick={() => void saveFavorite()}
                style={{ padding: "0.45rem 0.85rem", fontSize: "0.85rem" }}
              >
                ♥ Simpan
              </button>
            </div>
            <input
              placeholder="Catatan pribadi kos ini…"
              value={favNote}
              onChange={(event) => setFavNote(event.target.value)}
              style={{ padding: "0.45rem 0.65rem", fontSize: "0.84rem" }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function IconPin() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" style={{ flexShrink: 0 }}>
      <path d="M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function FacilityIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "#555", strokeWidth: 1.7, style: { flexShrink: 0 } };
  if (lower.includes("meter") || lower.includes("m²")) {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M9 5v14" />
      </svg>
    );
  }
  if (lower.includes("listrik")) {
    return (
      <svg {...props}>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
    );
  }
  if (lower.includes("kasur") || lower.includes("bed") || lower.includes("bantal") || lower.includes("guling")) {
    return (
      <svg {...props}>
        <path d="M3 18v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5M3 15h18M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
      </svg>
    );
  }
  if (lower.includes("mandi") || lower.includes("shower") || lower.includes("kloset") || lower.includes("water heater") || lower.includes("air")) {
    return (
      <svg {...props}>
        <path d="M4 12h16a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5v-2a1 1 0 0 1 1-1ZM6 12V6a2 2 0 0 1 4 0v1" />
      </svg>
    );
  }
  if (lower.includes("wifi") || lower.includes("internet")) {
    return (
      <svg {...props}>
        <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01" />
      </svg>
    );
  }
  if (lower.includes("parkir") || lower.includes("motor") || lower.includes("mobil") || lower.includes("sepeda")) {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 16V8h3a2.5 2.5 0 0 1 0 5h-3" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8.5 12.5 2.3 2.3 4.7-4.8" />
    </svg>
  );
}
