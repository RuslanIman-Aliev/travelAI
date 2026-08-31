export const INTERESTS_LIST = [
  "Museums",
  "Nature",
  "Food",
  "Nightlife",
  "Adventure",
  "Shopping",
  "History",
  "Relaxation",
];

export const BUDGET_RANGE: [number, number] = [0, 10000];

/** The slider in the new-trip form is denominated in USD. */
export const BUDGET_CURRENCY = "USD";

/** Shown whenever a trip has no destination photo (Pexels miss or outage). */
export const FALLBACK_TRIP_IMAGE = "/image-for-loading-page.png";

/**
 * Radius choices offered by the Live Guide form, in metres.
 *
 * Metres only. The list used to carry a `label` as well, the form stored that
 * label as its value, and the metres were recovered by searching the list for a
 * matching caption - so renaming "3 km" to "3 km away" would have broken the
 * search silently. The label is derived below instead.
 */
export const RADIUS_OPTIONS_METERS = [
  1_000, 3_000, 5_000, 10_000, 20_000, 30_000,
] as const;

/**
 * The value the radius field holds. A form field is a string, and this is the
 * one place that decides which string.
 *
 * @param {number} meters - A radius from `RADIUS_OPTIONS_METERS`.
 * @returns {string} The form value for that radius.
 */
export const radiusFieldValue = (meters: number) => String(meters);

/**
 * How a radius is written on screen.
 *
 * @param {number} meters - A radius in metres.
 * @returns {string} e.g. `"3 km"`.
 */
export const formatRadiusLabel = (meters: number) => `${meters / 1_000} km`;

/**
 * Reads the radius field back into metres.
 *
 * @param {string|null} [value] - The stored form value.
 * @returns {number|null} The radius in metres, or null when it is not one of the offered choices.
 */
export const radiusFromFieldValue = (value?: string | null) => {
  const meters = Number(value);
  return RADIUS_OPTIONS_METERS.includes(
    meters as (typeof RADIUS_OPTIONS_METERS)[number],
  )
    ? meters
    : null;
};
