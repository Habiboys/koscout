export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export function routeCacheKey(from: RoutePoint, to: RoutePoint, profile = "driving"): string {
  return `${profile}:${round(from.longitude)},${round(from.latitude)};${round(to.longitude)},${round(to.latitude)}`;
}

function round(value: number): string {
  return value.toFixed(4);
}
