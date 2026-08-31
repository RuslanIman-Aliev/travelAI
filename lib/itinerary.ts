import { Activity } from "@prisma/client";

export type ActivitySortMode = "auto" | "time" | "distance" | "manual";

const timePattern = /^(?:([01]?\d|2[0-3]):([0-5]\d))$/;

/**
 * Parses a time string (e.g., "14:30") into the total number of minutes since midnight.
 *
 * @param {string|null} [time] - The time string to parse.
 * @returns {number|null} The converted number of minutes, or null if the string is invalid/empty.
 */
const parseTimeToMinutes = (time?: string | null) => {
  const trimmed = time?.trim();
  if (!trimmed) return null;

  const match = trimmed.match(timePattern);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
};

/**
 * Checks if an activity holds valid geographic coordinates.
 *
 * @param {Activity} activity - The activity entity to examine.
 * @returns {boolean} True if both latitude and longitude are assigned, false otherwise.
 */
const hasCoordinates = (activity: Activity) =>
  activity.latitude != null && activity.longitude != null;

/**
 * Calculates the great-circle distance between two sets of coordinates using the Haversine formula.
 *
 * @param {number} fromLat - Starting point latitude.
 * @param {number} fromLng - Starting point longitude.
 * @param {number} toLat - Destination point latitude.
 * @param {number} toLng - Destination point longitude.
 * @returns {number} The distance in kilometers between the two points.
 */
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

/**
 * Finds the first activity in an array that has valid coordinate data.
 *
 * @param {Activity[]} activities - A list of activities to search.
 * @returns {Activity|null} The first compliant activity, or null if none possess coordinates.
 */
const getCoordinateAnchor = (activities: Activity[]) =>
  activities.find(hasCoordinates) ?? null;

/**
 * Sorts activities chronologically using their string-based time property.
 *
 * @param {Activity[]} activities - An array of activities to sort.
 * @returns {Activity[]} A fresh sorted array, grouping items without time at the end.
 */
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

/**
 * Sorts activities optimizing for the shortest geographical path (nearest-neighbor routing).
 * Items lacking coordinates are relocated to the end of the array.
 *
 * @param {Activity[]} activities - The array of activities to sequence.
 * @returns {Activity[]} A newly sorted array reflecting a continuously nearest path.
 */
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

/**
 * Chooses an appropriate sorting method and applies it to the array of activities.
 *
 * @param {Activity[]} activities - The activities to sort.
 * @param {ActivitySortMode} [sortMode="auto"] - The requested strategy for arranging the items.
 * @returns {Activity[]} The sorted array based on time, distance, or a default strategy.
 */
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

/**
 * Whether this day has ever been arranged by hand.
 *
 * @param {Activity[]} activities - The day's activities.
 * @returns {boolean} True when at least one activity carries a saved position.
 */
export const hasUserOrder = (activities: Activity[]) =>
  activities.some((activity) => activity.userOrder != null);

/**
 * Orders a day the way the user arranged it, falling back to the generated
 * order for a day nobody has touched.
 *
 * `userOrder` is written for every activity in the day at once, so the two
 * fields are never mixed within a single day - the fallback applies to the whole
 * day or to none of it.
 *
 * @param {Activity[]} activities - The day's activities.
 * @returns {Activity[]} A new array in the saved order.
 */
export const sortByUserOrder = (activities: Activity[]) =>
  [...activities].sort(
    (a, b) => (a.userOrder ?? a.order) - (b.userOrder ?? b.order),
  );

/**
 * Moves one activity up or down by a single position.
 *
 * The touch fallback for drag-and-drop: HTML5 DnD does not fire on touch
 * devices at all, so on a phone the Manual mode could be selected and then did
 * nothing.
 *
 * @param {string[]} order - The current order of activity ids.
 * @param {string} activityId - The activity to move.
 * @param {-1|1} direction - Up (-1) or down (1).
 * @returns {string[]} The new order, unchanged at the ends.
 */
export const moveInOrder = (
  order: string[],
  activityId: string,
  direction: -1 | 1,
) => {
  const index = order.indexOf(activityId);
  const target = index + direction;

  if (index === -1 || target < 0 || target >= order.length) return order;

  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/**
 * Reorders activities to match a predetermined sequence established entirely by an array of IDs.
 *
 * @param {Activity[]} activities - The current activities.
 * @param {string[]} [manualOrder=[]] - An ordered array of Activity IDs.
 * @returns {Activity[]} The structured collection placing specified IDs first, then appending any absent ones.
 */
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
