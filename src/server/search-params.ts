import { FACILITIES } from "@/lib/facilities";
import { SOURCE_FILTERS } from "@/lib/sources";
import type { SearchFilters } from "@/server/listings";

export function readSearchFilters(params: URLSearchParams): SearchFilters {
  const budget = numberOrNull(params.get("maxBudget"));
  const radius = numberOrNull(params.get("radiusKm"));
  const minutes = numberOrNull(params.get("maxMinutes"));
  const gender = [...new Set(params.getAll("gender").flatMap((value) => value.split(",")))].filter(
    (value): value is "putra" | "putri" | "campur" => value === "putra" || value === "putri" || value === "campur",
  );
  const facilities = params
    .getAll("facility")
    .filter((id) => FACILITIES.some((item) => item.id === id));

  const minBudget = numberOrNull(params.get("minBudget"));
  const salary = numberOrNull(params.get("salary"));
  const source = params.get("source");
  return {
    minBudget: minBudget != null && minBudget > 0 ? Math.round(minBudget) : null,
    salary: salary != null && salary > 0 ? Math.round(salary) : null,
    maxBudget: budget != null && budget > 0 ? Math.round(budget) : null,
    gender,
    facilities,
    radiusKm: radius != null && radius > 0 ? radius : null,
    maxMinutes: minutes != null && minutes > 0 ? Math.round(minutes) : null,
    source: SOURCE_FILTERS.some((item) => item.id === source) ? source : null,
  };
}

export const COMPARE_LIMIT = 10;

export function readIdList(params: URLSearchParams, key = "ids"): string[] {
  const values = params.getAll(key);
  const combined = values.length > 0 ? values : (params.get(key)?.split(",") ?? []);
  return [...new Set(combined.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean))].slice(0, COMPARE_LIMIT);
}

function numberOrNull(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
