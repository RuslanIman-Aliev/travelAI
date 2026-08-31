/**
 * The one list of activity place types.
 *
 * It used to exist three times over: a Zod enum in `validators.ts`, display
 * metadata in `components/trip/place-type.ts`, and a marker-icon map in the map
 * component. Adding a type meant editing three files, and forgetting one of them
 * produced no error at all - the value simply fell back to "Activity".
 *
 * Everything downstream is now keyed by `PlaceTypeKey` through a `Record`, so an
 * omission is a type error instead of a silent fallback.
 */
export const PLACE_TYPE_LABELS = [
  "Sightseeing",
  "Food",
  "Relax",
  "Adventure",
  "Shopping",
  "Culture",
] as const;

/** The exact spelling the model is allowed to return, and what gets stored. */
export type PlaceTypeLabel = (typeof PLACE_TYPE_LABELS)[number];

/** The lowercased form everything looks up by. */
export type PlaceTypeKey = Lowercase<PlaceTypeLabel>;

export const PLACE_TYPE_KEYS = PLACE_TYPE_LABELS.map(
  (label) => label.toLowerCase() as PlaceTypeKey,
);

/**
 * Used when a stored `placeType` is missing or unrecognised. Kept separate from
 * the real keys: it is a rendering fallback, never something the model may emit.
 */
export const FALLBACK_PLACE_TYPE_KEY = "activity";

export type FallbackPlaceTypeKey = typeof FALLBACK_PLACE_TYPE_KEY;

/** Every key a renderer has to be able to draw. */
export type RenderablePlaceTypeKey = PlaceTypeKey | FallbackPlaceTypeKey;

const knownKeys = new Set<string>(PLACE_TYPE_KEYS);

/**
 * Normalises a stored place type into a key a renderer can look up.
 *
 * @param {string|null} [placeType] - The value stored on the activity.
 * @returns {RenderablePlaceTypeKey} A known key, or the fallback.
 */
export const toPlaceTypeKey = (
  placeType?: string | null,
): RenderablePlaceTypeKey => {
  if (!placeType) return FALLBACK_PLACE_TYPE_KEY;

  const key = placeType.toLowerCase().trim();
  return knownKeys.has(key) ? (key as PlaceTypeKey) : FALLBACK_PLACE_TYPE_KEY;
};
