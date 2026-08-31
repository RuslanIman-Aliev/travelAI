import { getPlaceTypeMeta } from "@/components/trip/place-type";
import {
  FALLBACK_PLACE_TYPE_KEY,
  PLACE_TYPE_KEYS,
  PLACE_TYPE_LABELS,
  toPlaceTypeKey,
} from "@/lib/place-types";

describe("toPlaceTypeKey", () => {
  it("normalises every label the model may return", () => {
    for (const label of PLACE_TYPE_LABELS) {
      expect(toPlaceTypeKey(label)).toBe(label.toLowerCase());
    }
  });

  it("tolerates casing and surrounding whitespace", () => {
    expect(toPlaceTypeKey("  CULTURE ")).toBe("culture");
  });

  it("falls back for a missing or unknown type", () => {
    expect(toPlaceTypeKey(undefined)).toBe(FALLBACK_PLACE_TYPE_KEY);
    expect(toPlaceTypeKey(null)).toBe(FALLBACK_PLACE_TYPE_KEY);
    expect(toPlaceTypeKey("")).toBe(FALLBACK_PLACE_TYPE_KEY);
    expect(toPlaceTypeKey("Nightlife")).toBe(FALLBACK_PLACE_TYPE_KEY);
  });
});

describe("getPlaceTypeMeta", () => {
  // The list used to exist three times over, and a type present in one copy but
  // missing from another rendered as "Activity" with no error anywhere. The
  // `Record` types make an omission a compile error; this checks the runtime
  // half - that every canonical type actually resolves to its own metadata.
  it("resolves distinct metadata for every canonical type", () => {
    const labels = new Set<string>();

    for (const label of PLACE_TYPE_LABELS) {
      const meta = getPlaceTypeMeta(label);

      expect(meta.key).toBe(label.toLowerCase());
      expect(meta.label).toBe(label);
      expect(meta.icon).toBeDefined();
      labels.add(meta.label);
    }

    expect(labels.size).toBe(PLACE_TYPE_LABELS.length);
    expect(labels.has("Activity")).toBe(false);
  });

  it("keeps the fallback out of the set the model may emit", () => {
    expect(PLACE_TYPE_KEYS).not.toContain(FALLBACK_PLACE_TYPE_KEY);
    expect(getPlaceTypeMeta("Nightlife").label).toBe("Activity");
  });
});
