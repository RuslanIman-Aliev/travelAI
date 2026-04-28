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
  key: string;
  label: string;
  icon: LucideIcon;
  textClass: string;
  chipClass: string;
};

const placeTypeList: PlaceTypeMeta[] = [
  {
    key: "sightseeing",
    label: "Sightseeing",
    icon: MapPin,
    textClass: "text-sky-400",
    chipClass: "border border-sky-400/40 bg-sky-500/10",
  },
  {
    key: "food",
    label: "Food",
    icon: Utensils,
    textClass: "text-amber-400",
    chipClass: "border border-amber-400/40 bg-amber-500/10",
  },
  {
    key: "relax",
    label: "Relax",
    icon: Coffee,
    textClass: "text-emerald-400",
    chipClass: "border border-emerald-400/40 bg-emerald-500/10",
  },
  {
    key: "adventure",
    label: "Adventure",
    icon: Mountain,
    textClass: "text-rose-400",
    chipClass: "border border-rose-400/40 bg-rose-500/10",
  },
  {
    key: "shopping",
    label: "Shopping",
    icon: ShoppingBag,
    textClass: "text-orange-400",
    chipClass: "border border-orange-400/40 bg-orange-500/10",
  },
  {
    key: "culture",
    label: "Culture",
    icon: Landmark,
    textClass: "text-teal-400",
    chipClass: "border border-teal-400/40 bg-teal-500/10",
  },
];

const placeTypeMap = new Map(placeTypeList.map((meta) => [meta.key, meta]));

const fallbackMeta: PlaceTypeMeta = {
  key: "activity",
  label: "Activity",
  icon: MapPin,
  textClass: "text-slate-300",
  chipClass: "border border-slate-400/30 bg-slate-500/10",
};

export const placeTypeLegend = placeTypeList;

export const getPlaceTypeMeta = (placeType?: string | null) => {
  if (!placeType) return fallbackMeta;
  const key = placeType.toLowerCase().trim();
  return placeTypeMap.get(key) ?? fallbackMeta;
};
