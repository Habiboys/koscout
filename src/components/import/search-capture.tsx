"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SOURCES = [
  { id: "rukita", label: "Rukita" },
  { id: "mamikos", label: "Mamikos" },
] as const;

const GENDERS = [
  { id: "", label: "Semua" },
  { id: "putri", label: "Putri" },
  { id: "putra", label: "Putra" },
  { id: "campur", label: "Campur" },
] as const;

export type CaptureSource = (typeof SOURCES)[number]["id"];
export type GenderPick = "" | "putra" | "putri" | "campur";
export type KosGender = "putra" | "putri" | "campur";

type SourcePull = {
  source: CaptureSource;
  ok: boolean;
  total: number;
  created: number;
  updated: number;
  message: string | null;
};

export function SearchCapture({
  sources: sourcesProp,
  onSourcesChange,
  genders = [],
  onGendersChange,
}: {
  sources?: CaptureSource[];
  onSourcesChange?: (next: CaptureSource[]) => void;
  genders?: KosGender[];
  onGendersChange?: (next: KosGender[]) => void;
}) {
  const router = useRouter();
  const [internalSources, setInternalSources] = useState<CaptureSource[]>(["rukita", "mamikos"]);
  const sources = sourcesProp ?? internalSources;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(id: CaptureSource) {
    const next = sources.includes(id) ? sources.filter((item) => item !== id) : [...sources, id];
    if (onSourcesChange) onSourcesChange(next);
    else setInternalSources(next);
  }

  async function pull() {
    setBusy(true);
    setStatus("Mengambil kos dari sumber yang dicentang…");
    const response = await fetch("/api/import/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources, city: "bandung" }),
    });
    const data = (await response.json()) as { error?: string; results?: SourcePull[] };
    setBusy(false);
    if (!response.ok || !data.results) {
      setStatus(data.error ?? "Pengambilan gagal.");
      return;
    }
    setStatus(
      data.results
        .map((item) => {
          const label = SOURCES.find((source) => source.id === item.source)?.label ?? item.source;
          if (!item.ok) return `${label}: ${item.message}`;
          return `${label}: ${item.total} kos (${item.created} baru, ${item.updated} diperbarui)`;
        })
        .join(" · "),
    );
    router.refresh();
  }

  return (
    <div className="row" style={{ flexWrap: "wrap", justifyContent: "flex-end" }}>
      {SOURCES.map((source) => (
        <label key={source.id} className="check">
          <input type="checkbox" checked={sources.includes(source.id)} onChange={() => toggle(source.id)} />
          {source.label}
        </label>
      ))}
      {onGendersChange ? (
        <>
          <span className="muted" style={{ fontSize: "0.82rem" }}>Jenis</span>
          {GENDERS.map((item) => {
            const selected = item.id === "" ? genders.length === 0 : genders.includes(item.id);
            return (
              <button
                key={item.id || "all"}
                className="filter-chip"
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  if (item.id === "") {
                    onGendersChange([]);
                    return;
                  }
                  const next = genders.includes(item.id)
                    ? genders.filter((gender) => gender !== item.id)
                    : [...genders, item.id];
                  onGendersChange(next);
                }}
              >
                {item.label}
              </button>
            );
          })}
        </>
      ) : null}
      <button className="btn" type="button" disabled={busy || sources.length === 0} onClick={() => void pull()}>
        Ambil sekarang
      </button>
      {status ? <span className="status">{status}</span> : null}
    </div>
  );
}
