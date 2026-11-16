export const FACILITIES = [
  {
    id: "ac",
    label: "AC",
    patterns: [/air\s*condition(?:er|ing)?/i, /\bac\b/i],
  },
  {
    id: "wifi",
    label: "Wi-Fi",
    patterns: [/\bwi-?fi\b/i, /\binternet\b/i],
  },
  {
    id: "private_bathroom",
    label: "Kamar mandi dalam",
    patterns: [
      /kamar\s*mandi\s*dalam/i,
      /k\.?\s*mandi\s*dalam/i,
      /\bkm\.?\s*dalam\b/i,
      /kamar\s*mandi\s*pribadi/i,
      /private\s*bathroom/i,
    ],
  },
  {
    id: "shared_bathroom",
    label: "Kamar mandi luar",
    patterns: [
      /kamar\s*mandi\s*luar/i,
      /k\.?\s*mandi\s*luar/i,
      /\bkm\.?\s*luar\b/i,
      /kamar\s*mandi\s*bersama/i,
      /shared\s*bathroom/i,
    ],
  },
  {
    id: "motorcycle_parking",
    label: "Parkir motor",
    patterns: [/parkir(?:an)?\s*motor/i],
  },
  {
    id: "kitchen",
    label: "Dapur",
    patterns: [/\bdapur\b/i, /\bkitchen\b/i],
  },
] as const;

export type FacilityId = (typeof FACILITIES)[number]["id"];

const FACILITY_IDS = new Set<string>(FACILITIES.map((item) => item.id));

export function isFacilityId(value: string): value is FacilityId {
  return FACILITY_IDS.has(value);
}

export function facilityLabel(id: string): string {
  return FACILITIES.find((item) => item.id === id)?.label ?? id;
}

export function parseFacilities(text: string): FacilityId[] {
  const found: FacilityId[] = [];

  for (const facility of FACILITIES) {
    for (const pattern of facility.patterns) {
      const match = pattern.exec(text);
      if (!match || match.index === undefined) {
        continue;
      }
      if (isNegated(text, match.index)) {
        break;
      }
      found.push(facility.id);
      break;
    }
  }

  return found;
}

function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 28), index).toLowerCase();
  return /(?:tidak(?:\s+ada)?|tanpa|without|no)\s*$/i.test(before);
}
