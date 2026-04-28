import { Activity } from "@prisma/client";

export type ActivitySortMode = "auto" | "time" | "distance" | "manual";

export type ActivityFilters = {
  sortMode: ActivitySortMode;
  enabledPlaceTypes: string[];
  manualOrder?: string[];
};

const timePattern = /^(?:([01]?\d|2[0-3]):([0-5]\d))$/;

const parseTimeToMinutes = (time?: string | null) => {
  const trimmed = time?.trim();
  if (!trimmed) return null;

  const match = trimmed.match(timePattern);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
};

const hasCoordinates = (activity: Activity) =>
  activity.latitude != null && activity.longitude != null;

const haversineDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) => {
  const earthRadius = 6371;
  const dLat = ((toLat - fromLat) * Math.PI) / 180;
  const dLng = ((toLng - fromLng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((fromLat * Math.PI) / 180) *
      Math.cos((toLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const getCoordinateAnchor = (activities: Activity[]) =>
  activities.find(hasCoordinates) ?? null;

// const getDistanceFromAnchor = (activity: Activity, anchor: Activity | null) => {
//   if (!anchor || !hasCoordinates(anchor) || !hasCoordinates(activity)) {
//     return Number.POSITIVE_INFINITY;
//   }

//   return haversineDistanceKm(
//     anchor.latitude as number,
//     anchor.longitude as number,
//     activity.latitude as number,
//     activity.longitude as number,
//   );
// };

const sortByTime = (activities: Activity[]) =>
  [...activities].sort((left, right) => {
    const leftTime = parseTimeToMinutes(left.time);
    const rightTime = parseTimeToMinutes(right.time);

    if (leftTime == null && rightTime == null) return 0;
    if (leftTime == null) return 1;
    if (rightTime == null) return -1;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.order - right.order;
  });

const sortByRouteDistance = (activities: Activity[]) => {
  const remaining = [...activities.filter(hasCoordinates)];
  const ordered: Activity[] = [];
  const anchor = getCoordinateAnchor(remaining);

  if (!anchor) return activities;

  ordered.push(anchor);
  remaining.splice(remaining.indexOf(anchor), 1);

  while (remaining.length > 0) {
    const previous = ordered[ordered.length - 1];
    let nextIndex = 0;
    let shortestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((candidate, index) => {
      const distance =
        previous.latitude != null &&
        previous.longitude != null &&
        candidate.latitude != null &&
        candidate.longitude != null
          ? haversineDistanceKm(
              previous.latitude,
              previous.longitude,
              candidate.latitude,
              candidate.longitude,
            )
          : Number.POSITIVE_INFINITY;

      if (distance < shortestDistance) {
        shortestDistance = distance;
        nextIndex = index;
      }
    });

    const [next] = remaining.splice(nextIndex, 1);
    ordered.push(next);
  }

  const withoutCoords = activities.filter(
    (activity) => !hasCoordinates(activity),
  );
  return [...ordered, ...withoutCoords];
};

export const filterActivitiesByPlaceType = (
  activities: Activity[],
  enabledPlaceTypes: string[],
) => {
  if (enabledPlaceTypes.length === 0) return activities;
  const normalized = new Set(
    enabledPlaceTypes.map((type) => type.toLowerCase()),
  );

  return activities.filter((activity) => {
    const placeType = activity.placeType?.toLowerCase().trim();
    if (!placeType) return normalized.has("activity");
    return normalized.has(placeType);
  });
};

export const sortActivities = (
  activities: Activity[],
  sortMode: ActivitySortMode = "auto",
) => {
  if (activities.length <= 1) return activities;

  if (sortMode === "manual") {
    return activities;
  }

  if (sortMode === "time") {
    return sortByTime(activities);
  }

  if (sortMode === "distance") {
    return sortByRouteDistance(activities);
  }

  const timeSorted = sortByTime(activities);
  const hasUsableTimes = timeSorted.some(
    (activity) => parseTimeToMinutes(activity.time) != null,
  );

  if (hasUsableTimes) {
    return timeSorted;
  }

  const hasCoordinatesAvailable = activities.filter(hasCoordinates).length > 1;
  if (hasCoordinatesAvailable) {
    return sortByRouteDistance(activities);
  }

  return activities;
};

export const sortActivitiesByManualOrder = (
  activities: Activity[],
  manualOrder: string[] = [],
) => {
  if (activities.length <= 1 || manualOrder.length === 0) return activities;

  const activityMap = new Map(
    activities.map((activity) => [activity.id, activity]),
  );
  const ordered: Activity[] = [];
  const seen = new Set<string>();

  manualOrder.forEach((activityId) => {
    const activity = activityMap.get(activityId);
    if (!activity) return;
    ordered.push(activity);
    seen.add(activityId);
  });

  activities.forEach((activity) => {
    if (seen.has(activity.id)) return;
    ordered.push(activity);
  });

  return ordered;
};

export const filterAndSortActivities = (
  activities: Activity[],
  filters: ActivityFilters,
) => {
  const filtered = filterActivitiesByPlaceType(
    activities,
    filters.enabledPlaceTypes,
  );

  if (filters.sortMode === "manual") {
    return sortActivitiesByManualOrder(filtered, filters.manualOrder);
  }

  return sortActivities(filtered, filters.sortMode);
};

export const reorderManualOrder = (
  currentOrder: string[],
  visibleOrder: string[],
  draggedId: string,
  targetId: string,
) => {
  if (draggedId === targetId) return currentOrder;

  const currentVisible = visibleOrder.filter((id) => currentOrder.includes(id));
  const draggedIndex = currentVisible.indexOf(draggedId);
  const targetIndex = currentVisible.indexOf(targetId);

  if (draggedIndex === -1 || targetIndex === -1) return currentOrder;

  const nextVisible = [...currentVisible];
  const [removed] = nextVisible.splice(draggedIndex, 1);
  nextVisible.splice(targetIndex, 0, removed);

  const nextOrder = [...currentOrder];
  const visibleIdSet = new Set(currentVisible);
  let visiblePointer = 0;

  return nextOrder.map((activityId) => {
    if (!visibleIdSet.has(activityId)) {
      return activityId;
    }

    const replacement = nextVisible[visiblePointer];
    visiblePointer += 1;
    return replacement;
  });
};

export const buildRoutePath = (activities: Activity[]) =>
  activities.filter(hasCoordinates).map((activity) => ({
    lat: activity.latitude as number,
    lng: activity.longitude as number,
  }));

export const getRouteAnchor = (activities: Activity[]) =>
  getCoordinateAnchor(activities);
