"use client";

import { useState } from "react";

type Analysis = {
  bestOverall?: string;
  ranking?: Array<{ name: string; reasons?: string[]; pros?: string[]; cons?: string[] }>;
  caveats?: string[];
};

export function AiPanel({ ids }: { ids: string[] }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");

  async function analyze() {
    setStatus("Gemini sedang membaca data…");
    const response = await fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Analisis gagal.");
      return;
    }
    setAnalysis(body.analysis);
    setStatus("Analisis tersimpan di percakapan lokal.");
  }

  async function ask() {
    if (!question.trim()) return;
    setStatus("Mengirim pertanyaan…");
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, question }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error ?? "Pertanyaan gagal.");
      return;
    }
    setAnswer(body.answer ?? body.text ?? "");
    setQuestion("");
    setStatus("Jawaban memakai data kos yang dipilih.");
  }

  return (
    <section className="card card-pad stack">
      <h2>Analisis Gemini</h2>
      <p className="muted">Jawaban hanya dari data yang diekspor. Data kosong tetap disebut belum diketahui.</p>
      <div className="row">
        <button className="btn clay" type="button" onClick={() => void analyze()}>
          Analisis pilihan
        </button>
        <span className="status">{status}</span>
      </div>
      {analysis ? (
        <div className="stack">
          {analysis.bestOverall ? <p>Pilihan keseluruhan: {analysis.bestOverall}</p> : null}
          {analysis.ranking?.map((item) => (
            <article key={item.name} className="stack">
              <h3>{item.name}</h3>
              <p>{item.reasons?.join(" ")}</p>
              <p className="muted">Plus: {item.pros?.join(", ") || "—"}</p>
              <p className="muted">Minus: {item.cons?.join(", ") || "—"}</p>
            </article>
          ))}
          {analysis.caveats && analysis.caveats.length > 0 ? <p className="help">{analysis.caveats.join(" ")}</p> : null}
        </div>
      ) : null}
      <label className="field">
        <span>Pertanyaan lanjutan</span>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} />
      </label>
      <button className="btn secondary" type="button" onClick={() => void ask()}>
        Tanya
      </button>
      {answer ? <p>{answer}</p> : null}
    </section>
  );
}
