export const DEFAULT_FOCUS_KM = 15;

export function haversineKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earth = 6371;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function destination(latitude: number, longitude: number, distanceKm: number, bearing: number) {
  const radius = 6371;
  const angular = distanceKm / radius;
  const bearingRad = (bearing * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  const nextLat = Math.asin(
    Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearingRad),
  );
  const nextLon =
    lon +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angular) * Math.cos(lat),
      Math.cos(angular) - Math.sin(lat) * Math.sin(nextLat),
    );
  return { latitude: (nextLat * 180) / Math.PI, longitude: (nextLon * 180) / Math.PI };
}

export function circlePolygon(latitude: number, longitude: number, radiusKm: number, steps = 48) {
  const coordinates: Array<[number, number]> = [];
  for (let index = 0; index <= steps; index += 1) {
    const point = destination(latitude, longitude, radiusKm, (360 / steps) * index);
    coordinates.push([point.longitude, point.latitude]);
  }
  return { type: "Polygon" as const, coordinates: [coordinates] };
}

export function mapsRoutePaste(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): string {
  const pair = (point: { latitude: number; longitude: number }) => `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  return `${pair(from)} to ${pair(to)}`;
}
