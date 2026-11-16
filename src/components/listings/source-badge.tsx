import { describeSource } from "@/lib/sources";

export function SourceBadge({
  sourceName,
  sourceUrl,
}: {
  sourceName: string | null;
  sourceUrl: string | null;
}) {
  const source = describeSource(sourceName, sourceUrl);
  return (
    <span className="badge source" data-source={source.id}>
      {source.label}
    </span>
  );
}

export function SourceLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a className="btn secondary" href={url} target="_blank" rel="noreferrer">
      Situs asli
    </a>
  );
}
