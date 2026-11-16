import { describe, expect, it } from "vitest";
import { routeCacheKey } from "./route-key";

describe("route cache", () => {
  it("menggabungkan titik yang berdekatan ke kunci cache yang sama", () => {
    const origin = { latitude: -6.20881, longitude: 106.82204 };
    const nearbyOrigin = { latitude: -6.20884, longitude: 106.82201 };
    const destination = { latitude: -6.2147, longitude: 106.8186 };

    expect(routeCacheKey(origin, destination)).toBe(routeCacheKey(nearbyOrigin, destination));
    expect(routeCacheKey(origin, destination)).toBe("driving:106.8220,-6.2088;106.8186,-6.2147");
  });
});
