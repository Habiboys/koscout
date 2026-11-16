export function completenessScore(input: {
  name?: string | null;
  priceAmount?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  gender?: string | null;
  facilities?: string[];
  address?: string | null;
}): number {
  const checks = [
    Boolean(input.name?.trim()),
    input.priceAmount != null,
    input.latitude != null && input.longitude != null,
    Boolean(input.gender && input.gender !== "unknown"),
    (input.facilities?.length ?? 0) > 0,
    Boolean(input.address?.trim()),
  ];
  return checks.filter(Boolean).length / checks.length;
}
