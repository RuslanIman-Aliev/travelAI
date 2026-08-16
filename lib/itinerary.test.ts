import { Activity } from "@prisma/client";
import {
  buildRoutePath,
  filterActivitiesByPlaceType,
  reorderManualOrder,
  sortActivities,
} from "@/lib/itinerary";

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: "activity_1",
  dayId: "day_1",
  title: "Activity",
  description: null,
  time: null,
  placeName: null,
  placeType: null,
  latitude: null,
  longitude: null,
  estimatedCostCents: null,
  estimatedCostCurrency: null,
  estimatedCostIsFree: false,
  order: 1,
  ...overrides,
});

describe("itinerary helpers", () => {
  it("filters activities by place type", () => {
    const activities = [
      makeActivity({ id: "1", placeType: "Food" }),
      makeActivity({ id: "2", placeType: "Culture" }),
      makeActivity({ id: "3", placeType: null }),
    ];

    const filtered = filterActivitiesByPlaceType(activities, ["food"]);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("1");
  });

  it("sorts by time when times are available", () => {
    const activities = [
      makeActivity({ id: "1", time: "14:00", order: 2 }),
      makeActivity({ id: "2", time: "09:30", order: 1 }),
      makeActivity({ id: "3", time: null, order: 3 }),
    ];

    const sorted = sortActivities(activities, "time");

    expect(sorted.map((activity) => activity.id)).toEqual(["2", "1", "3"]);
  });

  it("builds a route path from coordinate-backed activities", () => {
    const routePath = buildRoutePath([
      makeActivity({ id: "1", latitude: 10, longitude: 20 }),
      makeActivity({ id: "2", latitude: null, longitude: null }),
      makeActivity({ id: "3", latitude: 11, longitude: 21 }),
    ]);

    expect(routePath).toEqual([
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ]);
  });

  it("reorders the visible subset while preserving hidden items", () => {
    const nextOrder = reorderManualOrder(
      ["a", "b", "c", "d"],
      ["a", "c", "d"],
      "d",
      "a",
    );

    expect(nextOrder).toEqual(["d", "b", "a", "c"]);
  });

  it("keeps manual sort order as-is when requested", () => {
    const activities = [
      makeActivity({ id: "1", order: 3 }),
      makeActivity({ id: "2", order: 1 }),
      makeActivity({ id: "3", order: 2 }),
    ];

    expect(
      sortActivities(activities, "manual").map((activity) => activity.id),
    ).toEqual(["1", "2", "3"]);
  });
});
