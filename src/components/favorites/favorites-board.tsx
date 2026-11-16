"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatIdr } from "@/lib/format";

const STATUSES = [
  ["saved", "Tersimpan"],
  ["contacted", "Sudah dihubungi"],
  ["survey_scheduled", "Jadwal survei"],
  ["surveyed", "Sudah survei"],
  ["chosen", "Dipilih"],
  ["rejected", "Ditolak"],
] as const;

export type FavoriteItem = {
  id: string;
  listingId: string;
  name: string;
  priceAmount: number | null;
  status: string;
  note: string | null;
};

export function FavoritesBoard({ items }: { items: FavoriteItem[] }) {
  const router = useRouter();
  const [status, setStatus] = useState("");

  async function update(listingId: string, next: string) {
    const response = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, status: next }),
    });
    setStatus(response.ok ? "Status diperbarui." : "Status gagal disimpan.");
    router.refresh();
  }

  async function remove(listingId: string) {
    const response = await fetch(`/api/favorites?listingId=${encodeURIComponent(listingId)}`, { method: "DELETE" });
    setStatus(response.ok ? "Dihapus dari favorit." : "Gagal menghapus.");
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <section className="card card-pad stack">
        <h1>Favorit</h1>
        <p>
          Belum ada kos tersimpan. Buka detail kos lalu simpan statusnya. <Link href="/search">Ke pencarian</Link>
        </p>
      </section>
    );
  }

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <h1>Favorit</h1>
        <p className="muted">Status berjalan dari tersimpan, dihubungi, jadwal survei, sudah survei, lalu dipilih atau ditolak.</p>
        <span className="status">{status}</span>
      </section>
      {STATUSES.map(([value, label]) => {
        const group = items.filter((item) => item.status === value);
        if (group.length === 0) return null;
        return (
          <section key={value} className="card card-pad stack">
            <h2>{label}</h2>
            {group.map((item) => (
              <article key={item.id} className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <Link href={`/listings/${item.listingId}`}>{item.name}</Link>
                  <p className="muted">
                    {formatIdr(item.priceAmount)}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                <div className="row">
                  <label className="field" style={{ width: 190 }}>
                    <span>Status</span>
                    <select value={item.status} onChange={(event) => void update(item.listingId, event.target.value)}>
                    {STATUSES.map(([option, optionLabel]) => (
                      <option key={option} value={option}>
                        {optionLabel}
                      </option>
                    ))}
                  </select>
                  </label>
                  <button className="btn secondary" type="button" onClick={() => void remove(item.listingId)}>
                    Hapus
                  </button>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
