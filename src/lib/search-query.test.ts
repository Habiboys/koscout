import { describe, expect, it } from "vitest";
import { matchesListingQuery } from "@/lib/search-query";

describe("matchesListingQuery", () => {
  it("matches a shortened card name when the typed title puts the area in a different place", () => {
    expect(
      matchesListingQuery(
        "Kost Millenial Tipe A Barat",
        "Parongpong, Bandung",
        "Kost Millenial Tipe A Parongpong Bandung Barat",
      ),
    ).toBe(true);
  });

  it("rejects a query whose words are missing", () => {
    expect(matchesListingQuery("Kost Millenial Tipe A Barat", "Parongpong, Bandung", "Kost Melati Dago")).toBe(false);
  });
});
