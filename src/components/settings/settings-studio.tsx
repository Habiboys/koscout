"use client";

import { useEffect, useState } from "react";

type Weights = {
  price: number;
  commute: number;
  facilities: number;
  nearby: number;
  transport: number;
};

type AiPrefs = {
  model: string;
  language: string;
  detail: "singkat" | "lengkap";
  enabled: boolean;
};

export function SettingsStudio() {
  const [weights, setWeights] = useState<Weights>({
    price: 25,
    commute: 30,
    facilities: 20,
    nearby: 15,
    transport: 10,
  });
  const [ai, setAi] = useState<AiPrefs>({
    model: "gemini-2.5-flash",
    language: "id",
    detail: "singkat",
    enabled: true,
  });
  const [geminiKey, setGeminiKey] = useState("");
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState("Memuat pengaturan…");

  useEffect(() => {
    void fetch("/api/settings")
      .then((response) => response.json())
      .then((body) => {
        setWeights(body.weights);
        setAi(body.ai);
        setConfigured(Boolean(body.geminiConfigured));
        setStatus(body.geminiConfigured ? "Kunci Gemini tersimpan di mesin ini." : "Kunci Gemini belum ada.");
      })
      .catch(() => setStatus("Pengaturan gagal dimuat."));
  }, []);

  async function save() {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weights,
        ai,
        ...(geminiKey.trim() ? { geminiKey: geminiKey.trim() } : {}),
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Pengaturan gagal disimpan.");
      return;
    }
    setGeminiKey("");
    setConfigured(Boolean(body.geminiConfigured));
    setStatus("Pengaturan tersimpan. Kunci tidak ditampilkan kembali.");
  }

  async function testConnection() {
    setStatus("Menguji sambungan Gemini…");
    const response = await fetch("/api/ai/test-connection", { method: "POST" });
    const body = await response.json();
    setStatus(response.ok ? `Sambungan berhasil: ${body.sample ?? "tersambung"}` : (body.error ?? "Sambungan gagal."));
  }

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <h1>Pengaturan</h1>
        <p className="muted">
          Bobot dinormalisasi ke 100. Komponen yang datanya kosong dilewati, bukan dinilai nol. Kunci Gemini disimpan
          terenkripsi di folder data, atau lewat variabel GEMINI_API_KEY.
        </p>
        {(["price", "commute", "facilities", "nearby", "transport"] as const).map((key) => (
          <label key={key} className="field">
            <span>
              {labelFor(key)} · {weights[key]}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key]}
              onChange={(event) => setWeights({ ...weights, [key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </section>
      <section className="card card-pad stack">
        <h2>Gemini</h2>
        <p className="muted">{configured ? "Kunci sudah terpasang." : "Belum ada kunci. Analisis AI tidak akan jalan."}</p>
        <label className="field">
          <span>Kunci API baru</span>
          <input
            type="password"
            autoComplete="off"
            value={geminiKey}
            placeholder="Tidak ditampilkan setelah disimpan"
            onChange={(event) => setGeminiKey(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input value={ai.model} onChange={(event) => setAi({ ...ai, model: event.target.value })} />
        </label>
        <div className="row">
          <label className="field">
            <span>Bahasa</span>
            <input value={ai.language} onChange={(event) => setAi({ ...ai, language: event.target.value })} />
          </label>
          <label className="field">
            <span>Detail</span>
            <select
              value={ai.detail}
              onChange={(event) => setAi({ ...ai, detail: event.target.value as "singkat" | "lengkap" })}
            >
              <option value="singkat">Singkat</option>
              <option value="lengkap">Lengkap</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={ai.enabled}
              onChange={(event) => setAi({ ...ai, enabled: event.target.checked })}
            />
            Analisis AI aktif
          </label>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={() => void save()}>
            Simpan
          </button>
          <button className="btn secondary" type="button" onClick={() => void testConnection()}>
            Uji sambungan
          </button>
          <span className="status">{status}</span>
        </div>
      </section>
    </div>
  );
}

function labelFor(key: keyof Weights): string {
  if (key === "price") return "Harga";
  if (key === "commute") return "Waktu tempuh";
  if (key === "facilities") return "Fasilitas";
  if (key === "nearby") return "Sekitar";
  return "Transportasi";
}
