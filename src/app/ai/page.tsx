import Link from "next/link";
import { AiPanel } from "@/components/compare/ai-panel";
import { readIdList } from "@/server/search-params";

export const dynamic = "force-dynamic";

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  const ids = readIdList(params);

  return (
    <div className="stack">
      {ids.length === 0 ? (
        <section className="card card-pad stack">
          <h1>Analisis AI</h1>
          <p>
            Pilih kos di halaman bandingkan. Panel Gemini juga ada di sana. <Link href="/compare">Ke perbandingan</Link>
          </p>
        </section>
      ) : (
        <AiPanel ids={ids} />
      )}
    </div>
  );
}
