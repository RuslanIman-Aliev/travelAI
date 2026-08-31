import {
  FALLBACK_PLACE_TYPE_KEY,
  toPlaceTypeKey,
  type PlaceTypeLabel,
  type RenderablePlaceTypeKey,
} from "@/lib/place-types";
import {
  Coffee,
  Landmark,
  MapPin,
  Mountain,
  ShoppingBag,
  Utensils,
  type LucideIcon,
} from "lucide-react";

export type PlaceTypeMeta = {
  key: RenderablePlaceTypeKey;
  label: string;
  icon: LucideIcon;
  textClass: string;
  chipClass: string;
};

/**
 * How each place type is drawn. Typed as a `Record` over the canonical keys on
 * purpose: adding a type to `PLACE_TYPE_LABELS` and forgetting this file is now
 * a compile error rather than a chip that quietly says "Activity".
 */
const placeTypeStyles: Record<
  RenderablePlaceTypeKey,
  Omit<PlaceTypeMeta, "key" | "label"> & { label?: string }
> = {
  sightseeing: {
    icon: MapPin,
    textClass: "text-sky-400",
    chipClass: "border border-sky-400/40 bg-sky-500/10",
  },
  food: {
    icon: Utensils,
    textClass: "text-amber-400",
    chipClass: "border border-amber-400/40 bg-amber-500/10",
  },
  relax: {
    icon: Coffee,
    textClass: "text-emerald-400",
    chipClass: "border border-emerald-400/40 bg-emerald-500/10",
  },
  adventure: {
    icon: Mountain,
    textClass: "text-rose-400",
    chipClass: "border border-rose-400/40 bg-rose-500/10",
  },
  shopping: {
    icon: ShoppingBag,
    textClass: "text-orange-400",
    chipClass: "border border-orange-400/40 bg-orange-500/10",
  },
  culture: {
    icon: Landmark,
    textClass: "text-teal-400",
    chipClass: "border border-teal-400/40 bg-teal-500/10",
  },
  [FALLBACK_PLACE_TYPE_KEY]: {
    label: "Activity",
    icon: MapPin,
    textClass: "text-slate-300",
    chipClass: "border border-slate-400/30 bg-slate-500/10",
  },
};

/** Title-cases a key back into the label it came from. */
const labelForKey = (key: RenderablePlaceTypeKey) =>
  (key.charAt(0).toUpperCase() + key.slice(1)) as PlaceTypeLabel;

/**
 * Resolves display metadata (label, icon, colours) for an activity place type,
 * falling back to a neutral "Activity" when the type is missing or unknown.
 *
 * @param {string|null} [placeType] - The stored place type.
 * @returns {PlaceTypeMeta} Metadata for rendering the type.
 */
export const getPlaceTypeMeta = (placeType?: string | null): PlaceTypeMeta => {
  const key = toPlaceTypeKey(placeType);
  const style = placeTypeStyles[key];

  return {
    key,
    label: style.label ?? labelForKey(key),
    icon: style.icon,
    textClass: style.textClass,
    chipClass: style.chipClass,
  };
};
