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

/** Radius choices offered by the Live Guide form, in metres. */
export const RADIUS_OPTIONS = [
  { label: "1 km", meters: 1_000 },
  { label: "3 km", meters: 3_000 },
  { label: "5 km", meters: 5_000 },
  { label: "10 km", meters: 10_000 },
  { label: "20 km", meters: 20_000 },
  { label: "30 km", meters: 30_000 },
] as const;
