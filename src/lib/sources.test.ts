import { describe, expect, it } from "vitest";
import { describeSource, matchesSource } from "@/lib/sources";

describe("sumber listing", () => {
  it("mengenali Mamikos dari tautan dan menandai contoh", () => {
    expect(describeSource(null, "https://www.mamikos.com/room/1")).toEqual({ id: "mamikos", label: "Mamikos" });
    expect(describeSource("contoh", "https://example.com/kos-melati").label).toBe("Contoh");
    expect(describeSource(null, "https://kos-lain.co.id/kamar").label).toBe("kos-lain.co.id");
  });

  it("menyaring sesuai pilihan sumber", () => {
    expect(matchesSource("mamikos", null, "https://mamikos.com/room/2")).toBe(true);
    expect(matchesSource("mamikos", "contoh", "https://example.com/kos")).toBe(false);
    expect(matchesSource("all", "contoh", null)).toBe(true);
    expect(matchesSource("other", null, "https://kos-lain.co.id/kamar")).toBe(true);
  });
});
