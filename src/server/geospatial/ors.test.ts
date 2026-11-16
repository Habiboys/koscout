import { describe, expect, it } from "vitest";
import { readOrsDirection, readOrsIsochrone } from "./ors";

describe("openrouteservice", () => {
  it("membaca jarak, waktu, dan garis rute", () => {
    const route = readOrsDirection(
      {
        features: [
          {
            properties: { summary: { distance: 650.9, duration: 146.6 } },
            geometry: {
              type: "LineString",
              coordinates: [
                [107.5958, -6.8619],
                [107.5996, -6.8649],
              ],
            },
          },
        ],
      },
      true,
    );
    expect(route).toEqual({
      distanceMeters: 651,
      durationSeconds: 147,
      geometry: JSON.stringify({
        type: "LineString",
        coordinates: [
          [107.5958, -6.8619],
          [107.5996, -6.8649],
        ],
      }),
    });
  });

  it("mengabaikan jawaban tanpa ringkasan rute", () => {
    expect(readOrsDirection({ features: [] }, true)).toBeNull();
  });

  it("membaca polygon isochrone", () => {
    const polygon = readOrsIsochrone({
      features: [{ geometry: { type: "Polygon", coordinates: [[[107.5, -6.8], [107.6, -6.9], [107.5, -6.8]]] } }],
    });
    expect(polygon?.type).toBe("Polygon");
    expect(polygon?.coordinates[0]).toHaveLength(3);
  });
});
