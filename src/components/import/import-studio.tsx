"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FACILITIES } from "@/lib/facilities";
import { bookmarkletHref, SAMPLE_LISTING } from "@/lib/bookmarklet";
import { formatPercent } from "@/lib/format";
import type { ParsedListing } from "@/server/normalization/parse-listing";
import { MapCanvas } from "@/components/maps/map-canvas";
import { SearchCapture } from "@/components/import/search-capture";
import { SourceBadge } from "@/components/listings/source-badge";
import { SOURCE_FILTERS, sourceKey } from "@/lib/sources";

export function ImportStudio({
  origin,
  fromBookmarklet,
}: {
  origin: string;
  fromBookmarklet: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ParsedListing | null>(null);
  const [status, setStatus] = useState(fromBookmarklet ? "JSON listing ada di clipboard. Tempel, lalu analisis." : "");
  const [saving, setSaving] = useState(false);

  const markers = useMemo(() => {
    if (!draft?.latitude || !draft.longitude) return [];
    return [
      {
        id: "pin",
        latitude: draft.latitude,
        longitude: draft.longitude,
        label: draft.name || "Titik kos",
        tone: "pin" as const,
      },
    ];
  }, [draft]);

  async function analyze(source = text) {
    setStatus("Membaca teks…");
    const response = await fetch("/api/import/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: source }),
    });
    const data = (await response.json()) as ParsedListing & { error?: string };
    if (!response.ok) {
      setStatus(data.error ?? "Teks tidak bisa dibaca.");
      return;
    }
    setDraft(data);
    setStatus("Periksa hasilnya sebelum disimpan. Parser bisa salah.");
  }

  async function pasteClipboard() {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      await analyze(clip);
    } catch {
      setStatus("Clipboard tidak bisa dibaca. Tempel teksnya secara manual.");
    }
  }

  async function geocode() {
    if (!draft?.address) {
      setStatus("Isi alamat dulu, atau klik peta.");
      return;
    }
    setStatus("Mencari koordinat…");
    const response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: draft.address }),
    });
    const data = (await response.json()) as { latitude?: number; longitude?: number; label?: string; error?: string };
    if (!response.ok || data.latitude == null || data.longitude == null) {
      setStatus(data.error ?? "Alamat tidak ditemukan.");
      return;
    }
    setDraft({
      ...draft,
      latitude: data.latitude,
      longitude: data.longitude,
      locationQuality: "approximate",
    });
    setStatus(`Titik perkiraan: ${data.label}`);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setStatus("Menyimpan…");
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        sourceName: draft.sourceName,
        sourceUrl: draft.sourceUrl,
        imageUrls: draft.imageUrls,
        address: draft.address,
        latitude: draft.latitude,
        longitude: draft.longitude,
        locationQuality: draft.locationQuality,
        gender: draft.gender,
        priceAmount: draft.priceAmount,
        priceRaw: draft.priceRaw,
        pricePeriod: draft.pricePeriod,
        isStartingPrice: draft.isStartingPrice,
        extraFeesNote: draft.extraFeesNote,
        facilities: draft.facilities,
        availability: draft.availability,
        description: draft.description,
        rawText: draft.rawText,
      }),
    });
    const data = (await response.json()) as { record?: { id: string }; updated?: boolean; error?: string };
    setSaving(false);
    if (!response.ok || !data.record) {
      setStatus(data.error ?? "Gagal menyimpan.");
      return;
    }
    router.push(`/listings/${data.record.id}`);
    router.refresh();
  }

  return (
    <div className="stack">
      <section className="card card-pad">
        <SearchCapture />
      </section>
      <section className="card card-pad stack">
        <h1>Impor satu kos</h1>
        <p className="muted">
          Atau tempel teks dari satu halaman yang sedang terbuka. Gambar dan tautan ikut terbaca dari situs itu.
        </p>
        <div className="row">
          <a className="btn secondary" href={bookmarkletHref(origin)}>
            Simpan ke Koscout
          </a>
          <button className="btn secondary" type="button" onClick={() => setText(SAMPLE_LISTING)}>
            Isi contoh
          </button>
          <button className="btn secondary" type="button" onClick={() => void pasteClipboard()}>
            Tempel dari clipboard
          </button>
        </div>
        <p className="help">Seret “Simpan ke Koscout” ke bilah bookmark. Klik saat halaman listing sedang terbuka.</p>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Tempel judul, harga, alamat, dan fasilitas…"
        />
        <div className="row">
          <button className="btn" type="button" onClick={() => void analyze()} disabled={!text.trim()}>
            Analisis teks
          </button>
          <span className="status">{status}</span>
        </div>
      </section>

      {draft ? (
        <section className="split">
          <form
            className="card card-pad stack"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2>Periksa sebelum simpan</h2>
            <p className="muted">Kelengkapan data {formatPercent(draft.completeness)}. Field kosong tidak dihitung sebagai nol.</p>
            <label className="field">
              <span>Nama</span>
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="field">
              <span>Harga per bulan (Rp)</span>
              <input
                type="number"
                min={0}
                value={draft.priceAmount ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    priceAmount: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
            </label>
            {draft.estimateNote ? <p className="note">{draft.estimateNote}</p> : null}
            {draft.isStartingPrice ? <p className="badge clay">Harga mulai dari, bukan harga pasti</p> : null}
            {draft.priceRaw ? <p className="muted">Teks harga: {draft.priceRaw}</p> : null}
            <label className="field">
              <span>Jenis kos</span>
              <select
                value={draft.gender}
                onChange={(event) =>
                  setDraft({ ...draft, gender: event.target.value as ParsedListing["gender"] })
                }
              >
                <option value="unknown">Belum diketahui</option>
                <option value="putri">Putri</option>
                <option value="putra">Putra</option>
                <option value="campur">Campur</option>
              </select>
            </label>
            <fieldset className="stack">
              <legend className="muted">Fasilitas</legend>
              {FACILITIES.map((facility) => (
                <label key={facility.id} className="check">
                  <input
                    type="checkbox"
                    checked={draft.facilities.includes(facility.id)}
                    onChange={(event) => {
                      const facilities = event.target.checked
                        ? [...draft.facilities, facility.id]
                        : draft.facilities.filter((id) => id !== facility.id);
                      setDraft({ ...draft, facilities });
                    }}
                  />
                  {facility.label}
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>Alamat</span>
              <input
                value={draft.address ?? ""}
                onChange={(event) => setDraft({ ...draft, address: event.target.value || null })}
              />
            </label>
            <label className="field">
              <span>URL sumber</span>
              <input
                value={draft.sourceUrl ?? ""}
                onChange={(event) => {
                  const sourceUrl = event.target.value || null;
                  const locked = SOURCE_FILTERS.some((item) => item.id === draft.sourceName && item.id !== "other");
                  setDraft({
                    ...draft,
                    sourceUrl,
                    sourceName: locked ? draft.sourceName : sourceKey(null, sourceUrl),
                  });
                }}
              />
            </label>
            <label className="field">
              <span>Sumber</span>
              <div className="row">
                <SourceBadge sourceName={draft.sourceName} sourceUrl={draft.sourceUrl} />
                <select
                  value={SOURCE_FILTERS.some((item) => item.id === draft.sourceName) ? (draft.sourceName ?? "") : ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      sourceName: event.target.value || sourceKey(null, draft.sourceUrl),
                    })
                  }
                >
                  <option value="">Ikuti tautan</option>
                  {SOURCE_FILTERS.filter((item) => item.id !== "contoh").map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            {draft.imageUrls.length > 0 ? (
              <div className="row">
                {draft.imageUrls.map((url) => (
                  <img key={url} className="thumb" src={url} alt="" />
                ))}
              </div>
            ) : null}
            <label className="field">
              <span>Catatan biaya lain</span>
              <textarea
                value={draft.extraFeesNote ?? ""}
                onChange={(event) => setDraft({ ...draft, extraFeesNote: event.target.value || null })}
              />
            </label>
            <div className="row">
              <button className="btn secondary" type="button" onClick={() => void geocode()}>
                Cari koordinat dari alamat
              </button>
              <button className="btn" type="submit" disabled={saving || !draft.name.trim()}>
                Simpan kos
              </button>
              <span className="status">{status}</span>
            </div>
            <p className="help">
              {draft.locationQuality === "exact"
                ? "Titik dipasang di peta."
                : draft.locationQuality === "approximate"
                  ? "Titik ini perkiraan dari alamat. Klik peta untuk mengunci posisi."
                  : "Lokasi belum ada. Kos tetap bisa disimpan, tetapi tidak masuk filter jarak."}
            </p>
          </form>
          <MapCanvas
            markers={markers}
            onPick={(coords) =>
              setDraft({
                ...draft,
                latitude: coords.latitude,
                longitude: coords.longitude,
                locationQuality: "exact",
              })
            }
          />
        </section>
      ) : null}
    </div>
  );
}
