import { ImportStudio } from "@/components/import/import-studio";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
  return <ImportStudio origin={origin} fromBookmarklet={params.from === "bookmarklet"} />;
}
