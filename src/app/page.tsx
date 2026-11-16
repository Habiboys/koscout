import Link from "next/link";
import { prisma } from "@/server/db";
import { routeProviderName } from "@/server/geospatial/routing";
import { getActiveOffice } from "@/server/listings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [count, office] = await Promise.all([prisma.listing.count(), getActiveOffice()]);

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <p className="muted">Alat pribadi untuk memilih kos</p>
        <h1 className="hero-title">Sewa yang masuk akal, dengan perjalanan yang jelas.</h1>
        <p>
          Impor listing yang sedang kamu lihat, pasang titik kantor, lalu bandingkan harga, fasilitas wajib,
          dan waktu tempuh. Angka yang belum diketahui tetap ditulis sebagai belum diketahui.
        </p>
        <div className="row">
          <Link className="btn" href="/search">
            Cari kos
          </Link>
          <Link className="btn secondary" href="/import">
            Impor listing
          </Link>
        </div>
      </section>
      <section className="grid-stats">
        <article className="card card-pad stack">
          <span className="muted">Kantor aktif</span>
          <h2>{office?.name ?? "Belum dipasang"}</h2>
          <p className="muted">{office?.address ?? "Pasang titik kantor di halaman cari supaya jarak bisa dihitung."}</p>
        </article>
        <article className="card card-pad stack">
          <span className="muted">Kos tersimpan</span>
          <h2>{count}</h2>
          <p className="muted">Termasuk data contoh. Impor baru memperbarui listing jika URL sumbernya sama.</p>
        </article>
        <article className="card card-pad stack">
          <span className="muted">Waktu tempuh</span>
          <h2>{routeProviderName()}</h2>
          <p className="muted">Profil mengemudi, tanpa data kemacetan. Hasilnya disimpan supaya tidak diminta ulang.</p>
        </article>
      </section>
    </div>
  );
}
