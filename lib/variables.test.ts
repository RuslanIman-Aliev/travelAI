import {
  formatRadiusLabel,
  radiusFieldValue,
  radiusFromFieldValue,
  RADIUS_OPTIONS_METERS,
} from "@/lib/variables";

describe("radius field helpers", () => {
  it("round-trips every offered radius", () => {
    for (const meters of RADIUS_OPTIONS_METERS) {
      expect(radiusFromFieldValue(radiusFieldValue(meters))).toBe(meters);
    }
  });

  // The regression this guards: the form used to store the caption ("3 km") and
  // recover the metres by searching the option list for a matching caption, so
  // editing a caption silently broke the search.
  it("does not depend on the caption", () => {
    expect(radiusFromFieldValue("3000")).toBe(3_000);
    expect(radiusFromFieldValue("3 km")).toBeNull();
  });

  it("rejects a radius that is not on offer", () => {
    expect(radiusFromFieldValue("2500")).toBeNull();
    expect(radiusFromFieldValue("")).toBeNull();
    expect(radiusFromFieldValue(undefined)).toBeNull();
    expect(radiusFromFieldValue("not a number")).toBeNull();
  });

  it("derives the caption from the metres", () => {
    expect(formatRadiusLabel(1_000)).toBe("1 km");
    expect(formatRadiusLabel(30_000)).toBe("30 km");
  });
});
