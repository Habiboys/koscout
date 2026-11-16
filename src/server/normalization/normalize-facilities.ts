import { parseFacilities, type FacilityId } from "@/lib/facilities";
import type { Availability, Gender } from "@/lib/labels";

export function normalizeFacilities(text: string): FacilityId[] {
  return parseFacilities(text);
}

export function parseGender(text: string): Gender {
  const mentionsPutra = /\b(putra|pria|laki-laki|cowok|male)\b/i.test(text);
  const mentionsPutri = /\b(putri|wanita|perempuan|cewek|female)\b/i.test(text);
  const mentionsCampur = /\b(campur|campuran|mixed)\b/i.test(text);

  if (mentionsCampur || (mentionsPutra && mentionsPutri)) {
    return "campur";
  }
  if (mentionsPutri) return "putri";
  if (mentionsPutra) return "putra";
  return "unknown";
}

export function parseAvailability(text: string): Availability {
  const matches = [...text.matchAll(/\b(penuh|full book(?:ed)?|tidak tersedia|habis|tersedia|masih kosong|kosong|available)\b/gi)];
  const last = matches.at(-1)?.[1]?.toLowerCase();
  if (!last) return "unknown";
  if (last === "tersedia" || last === "kosong" || last === "available" || last === "masih kosong") {
    return "available";
  }
  return "full";
}
