"use client";

import { useState } from "react";

export function ExportBar({ href }: { href: string }) {
  const [status, setStatus] = useState("");

  async function copy(format: "json" | "prompt") {
    const response = await fetch(`${href}${href.includes("?") ? "&" : "?"}format=${format === "prompt" ? "prompt" : "json"}`);
    if (!response.ok) {
      setStatus("Ekspor gagal.");
      return;
    }
    if (format === "prompt") {
      const data = (await response.json()) as { prompt: string };
      await navigator.clipboard.writeText(data.prompt);
      setStatus("Prompt dan JSON disalin.");
      return;
    }
    const data = await response.json();
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setStatus("JSON disalin.");
  }

  return (
    <div className="row">
      <a className="btn" href={`${href}${href.includes("?") ? "&" : "?"}download=1`}>
        Unduh JSON
      </a>
      <button className="btn secondary" type="button" onClick={() => void copy("json")}>
        Salin JSON
      </button>
      <button className="btn clay" type="button" onClick={() => void copy("prompt")}>
        Salin JSON + prompt
      </button>
      <a className="btn secondary" href={`${href}${href.includes("?") ? "&" : "?"}format=markdown`}>
        Ekspor Markdown
      </a>
      <span className="status">{status}</span>
    </div>
  );
}
