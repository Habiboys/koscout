"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapCanvas } from "@/components/maps/map-canvas";
import type { MapShape } from "@/components/maps/kos-map";
import { formatIdr, formatKm } from "@/lib/format";
import { streetViewUrl, whatsappMessage } from "@/lib/listing-tools";
import { monthlyCost, transportMonthlyCost } from "@/server/cost/monthly-cost";
import type { NearbyReport } from "@/server/nearby/overpass";
import type { ListingWithCommute } from "@/server/listings";

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

type HistoryItem = { amount: number; recordedAt: string };

export function ListingInsights({
  listing,
  history,
  favorite,
  visit,
  nearby,
}: {
  listing: ListingWithCommute;
  history: HistoryItem[];
  favorite: { status: string; note: string | null } | null;
  visit: { checks: Record<string, string>; note: string | null; photoUrls: string[] } | null;
  nearby: NearbyReport | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(favorite?.status ?? "saved");
  const [note, setNote] = useState(favorite?.note ?? "");
  const [checks, setChecks] = useState<Record<string, "baik" | "cukup" | "buruk" | "belum">>(() => {
    const initial: Record<string, "baik" | "cukup" | "buruk" | "belum"> = {};
    for (const [id] of CHECKS) {
      const value = visit?.checks[id];
      initial[id] = value === "baik" || value === "cukup" || value === "buruk" ? value : "belum";
    }
    return initial;
  });
  const [visitNote, setVisitNote] = useState(visit?.note ?? "");
  const [photoUrls, setPhotoUrls] = useState(visit?.photoUrls.join("\n") ?? "");
  const [report, setNearby] = useState<NearbyReport | null>(nearby);
  const [costs, setCosts] = useState({
    roomSizeM2: listing.roomSizeM2,
    depositAmount: listing.depositAmount,
    adminFee: listing.adminFee,
    movingFee: listing.movingFee,
    electricityStatus: listing.electricityStatus,
    electricityMonthly: listing.electricityMonthly,
    internetStatus: listing.internetStatus,
    internetMonthly: listing.internetMonthly,
    laundryMonthly: listing.laundryMonthly,
    otherMonthly: listing.otherMonthly,
  });
  const [message, setMessage] = useState("");
  const [modes, setModes] = useState<Array<{ label: string; detail: string }>>([]);
  const [routeShape, setRouteShape] = useState<MapShape | null>(null);

  const cost = useMemo(
    () =>
      monthlyCost({
        rent: listing.priceAmount,
        electricityStatus: costs.electricityStatus,
        electricityMonthly: costs.electricityMonthly,
        internetStatus: costs.internetStatus,
        internetMonthly: costs.internetMonthly,
        laundryMonthly: costs.laundryMonthly,
        otherMonthly: costs.otherMonthly,
        transportMonthly: transportMonthlyCost(listing.distanceKm, "motorcycle"),
        depositAmount: costs.depositAmount,
        adminFee: costs.adminFee,
        movingFee: costs.movingFee,
      }),
    [costs, listing.distanceKm, listing.priceAmount],
  );
  const perMeter =
    listing.priceAmount != null && costs.roomSizeM2 != null && costs.roomSizeM2 > 0
      ? Math.round(listing.priceAmount / costs.roomSizeM2)
      : null;
  const wa = `https://wa.me/?text=${encodeURIComponent(
    whatsappMessage({
      name: listing.name,
      priceAmount: listing.priceAmount,
      electricityStatus: costs.electricityStatus,
      internetStatus: costs.internetStatus,
      depositAmount: costs.depositAmount,
      roomSizeM2: costs.roomSizeM2,
      availability: listing.availability,
      gender: listing.gender,
    }),
  )}`;

  async function saveFavorite() {
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, status, note }),
    });
    setMessage(response.ok ? "Status favorit tersimpan." : "Favorit gagal disimpan.");
    router.refresh();
  }

  async function saveCosts() {
    const response = await fetch(`/api/listings/${listing.id}/costs`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(costs),
    });
    setMessage(response.ok ? "Biaya tersimpan." : "Biaya gagal disimpan.");
    router.refresh();
  }

  async function saveVisit() {
    const response = await fetch(`/api/listings/${listing.id}/visit`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checks,
        note: visitNote,
        photoUrls: photoUrls.split("\n").map((item) => item.trim()).filter(Boolean),
      }),
    });
    setMessage(response.ok ? "Catatan survei tersimpan." : "Catatan survei gagal disimpan.");
  }

  async function loadNearby() {
    setMessage("Mengambil fasilitas sekitar dari OpenStreetMap…");
    const response = await fetch(`/api/listings/${listing.id}/nearby`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "Fasilitas sekitar gagal dihitung.");
      return;
    }
    setNearby(body.report);
    setMessage(body.cached ? "Data sekitar dari cache 7 hari." : "Data sekitar diperbarui.");
  }

  async function loadModes() {
    setMessage("Menghitung perkiraan moda…");
    const profiles = [
      ["foot", "Jalan kaki"],
      ["bike", "Sepeda"],
      ["driving", "Motor / mobil"],
    ] as const;
    const rows: Array<{ label: string; detail: string }> = [];
    for (const [profile, label] of profiles) {
      const response = await fetch(`/api/listings/${listing.id}/route?profile=${profile}`);
      const body = await response.json();
      if (!response.ok) {
        rows.push({ label, detail: "Belum tersedia" });
        continue;
      }
      const minutes = Math.max(1, Math.round(body.durationSeconds / 60));
      const km = (body.distanceMeters / 1000).toFixed(1);
      rows.push({ label, detail: `${minutes} menit · ${km} km` });
      if (profile === "driving" && body.geometry) {
        setRouteShape({ id: "route", color: "#b8612f", geojson: body.geometry });
      }
    }
    const motor = transportMonthlyCost(listing.distanceKm, "motorcycle");
    const car = transportMonthlyCost(listing.distanceKm, "car");
    const transit = transportMonthlyCost(listing.distanceKm, "transit");
    rows.push({
      label: "Perkiraan biaya",
      detail: `Motor ${formatIdr(motor)} / bulan · mobil ${formatIdr(car)} / bulan · angkutan ${formatIdr(transit)} / bulan. Bukan data kemacetan.`,
    });
    setModes(rows);
    setMessage("Perkiraan moda siap. Angkutan umum memakai tarif flat, bukan rute transit langsung.");
  }

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <h2>Biaya bulanan</h2>
        <p className="muted">
          Total hanya dijumlah jika setiap komponen diketahui. Listrik atau internet yang belum jelas tidak dihitung
          sebagai nol. Transport memakai perkiraan motor {formatKm(listing.distanceKm)} pulang-pergi, 22 hari.
        </p>
        <div className="row">
          <NumberField label="Luas m²" value={costs.roomSizeM2} onChange={(value) => setCosts({ ...costs, roomSizeM2: value })} />
          <NumberField label="Deposit" value={costs.depositAmount} onChange={(value) => setCosts({ ...costs, depositAmount: value })} />
          <NumberField label="Admin" value={costs.adminFee} onChange={(value) => setCosts({ ...costs, adminFee: value })} />
          <NumberField label="Pindahan" value={costs.movingFee} onChange={(value) => setCosts({ ...costs, movingFee: value })} />
        </div>
        <div className="row">
          <FeeField
            label="Listrik"
            status={costs.electricityStatus}
            amount={costs.electricityMonthly}
            onStatus={(value) => setCosts({ ...costs, electricityStatus: value })}
            onAmount={(value) => setCosts({ ...costs, electricityMonthly: value })}
          />
          <FeeField
            label="Internet"
            status={costs.internetStatus}
            amount={costs.internetMonthly}
            onStatus={(value) => setCosts({ ...costs, internetStatus: value })}
            onAmount={(value) => setCosts({ ...costs, internetMonthly: value })}
          />
          <NumberField label="Laundry / bulan" value={costs.laundryMonthly} onChange={(value) => setCosts({ ...costs, laundryMonthly: value })} />
          <NumberField label="Lainnya / bulan" value={costs.otherMonthly} onChange={(value) => setCosts({ ...costs, otherMonthly: value })} />
        </div>
        <p>
          Harga per m²: {formatIdr(perMeter)} · total bulanan: {formatIdr(cost.monthly)} · biaya awal: {formatIdr(cost.upfront)}
        </p>
        <p className="muted">
          Proyeksi {cost.projections.map((item) => `${item.months} bulan ${formatIdr(item.total)}`).join(" · ")}
          {cost.missing.length > 0 ? ` · belum diketahui: ${cost.missing.join(", ")}` : ""}
        </p>
        <button className="btn" type="button" onClick={() => void saveCosts()}>
          Simpan biaya
        </button>
      </section>

      <section className="card card-pad stack">
        <h2>Sekitar dan lingkungan</h2>
        <div className="row">
          <button className="btn secondary" type="button" onClick={() => void loadNearby()}>
            Hitung dari OpenStreetMap
          </button>
          <button className="btn secondary" type="button" onClick={() => void loadModes()}>
            Bandingkan moda
          </button>
          {listing.latitude != null && listing.longitude != null ? (
            <a className="btn secondary" href={streetViewUrl(listing.latitude, listing.longitude)} target="_blank" rel="noreferrer">
              Street View
            </a>
          ) : null}
          <a className="btn clay" href={wa} target="_blank" rel="noreferrer">
            Template WhatsApp
          </a>
        </div>
        {report ? (
          <div className="stack">
            {report.categories.map((item) => (
              <p key={item.id}>
                {item.label}: {item.count} titik
                {item.nearestMeters != null ? ` · terdekat ${item.nearestMeters} m` : ""}
              </p>
            ))}
            <p>
              Jarak ke sungai/kanal OSM: {report.waterwayMeters == null ? "tidak ketemu dalam 1,5 km" : `${report.waterwayMeters} m`}
            </p>
            <p className="help">
              Ini hanya jarak ke waterway di OpenStreetMap, plus catatan Anda. Bukan sertifikat banjir resmi. OSM di
              Indonesia sering tidak lengkap.
            </p>
          </div>
        ) : (
          <p className="muted">Fasilitas sekitar belum dihitung.</p>
        )}
        {modes.length > 0 ? (
          <div className="stack">
            {modes.map((item) => (
              <p key={item.label}>
                <strong>{item.label}.</strong> {item.detail}
              </p>
            ))}
          </div>
        ) : null}
        {routeShape && listing.latitude != null && listing.longitude != null ? (
          <MapCanvas
            markers={[
              {
                id: listing.id,
                latitude: listing.latitude,
                longitude: listing.longitude,
                label: listing.name,
                tone: "listing",
              },
            ]}
            shapes={[routeShape]}
          />
        ) : null}
      </section>

      <section className="card card-pad stack">
        <h2>Favorit dan survei</h2>
        <div className="row">
          <label className="field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUSES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field" style={{ flex: 1 }}>
            <span>Catatan</span>
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button className="btn" type="button" onClick={() => void saveFavorite()}>
            Simpan status
          </button>
        </div>
        <div className="field-grid">
          {CHECKS.map(([id, label]) => (
            <label key={id} className="field">
              <span>{label}</span>
              <select
                value={checks[id]}
                onChange={(event) =>
                  setChecks({ ...checks, [id]: event.target.value as "baik" | "cukup" | "buruk" | "belum" })
                }
              >
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="field">
          <span>Catatan kunjungan</span>
          <textarea value={visitNote} onChange={(event) => setVisitNote(event.target.value)} rows={3} />
        </label>
        <label className="field">
          <span>URL foto, satu per baris</span>
          <textarea value={photoUrls} onChange={(event) => setPhotoUrls(event.target.value)} rows={3} />
        </label>
        <button className="btn secondary" type="button" onClick={() => void saveVisit()}>
          Simpan survei
        </button>
      </section>

      <section className="card card-pad stack">
        <h2>Riwayat harga</h2>
        {history.length === 0 ? <p className="muted">Belum ada perubahan harga tercatat.</p> : null}
        {history.map((item) => (
          <p key={item.recordedAt}>
            {formatIdr(item.amount)} · {new Date(item.recordedAt).toLocaleString("id-ID")}
          </p>
        ))}
      </section>
      <p className="status">{message}</p>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="field" style={{ width: 160 }}>
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      />
    </label>
  );
}

function FeeField({
  label,
  status,
  amount,
  onStatus,
  onAmount,
}: {
  label: string;
  status: string;
  amount: number | null;
  onStatus: (value: string) => void;
  onAmount: (value: number | null) => void;
}) {
  return (
    <div className="field" style={{ width: 220 }}>
      <span>{label}</span>
      <select value={status} onChange={(event) => onStatus(event.target.value)}>
        <option value="unknown">Belum diketahui</option>
        <option value="included">Termasuk sewa</option>
        <option value="excluded">Bayar sendiri</option>
      </select>
      {status === "excluded" ? (
        <input
          type="number"
          min={0}
          placeholder="Per bulan"
          value={amount ?? ""}
          onChange={(event) => onAmount(event.target.value === "" ? null : Number(event.target.value))}
        />
      ) : null}
    </div>
  );
}
