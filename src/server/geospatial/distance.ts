import distance from "@turf/distance";
import { point } from "@turf/helpers";

export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const kilometers = distance(point([from.longitude, from.latitude]), point([to.longitude, to.latitude]), {
    units: "kilometers",
  });
  return Math.round(kilometers * 100) / 100;
}
