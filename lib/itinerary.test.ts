import { Activity } from "@prisma/client";
import {
  buildRoutePath,
  hasUserOrder,
  moveInOrder,
  reorderManualOrder,
  sortActivities,
  sortByUserOrder,
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
  userOrder: null,
  ...overrides,
});

describe("itinerary helpers", () => {
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

  // The manual arrangement lives in the database now, not the query string.
  describe("saved order", () => {
    it("falls back to the generated order for a day nobody has touched", () => {
      const activities = [
        makeActivity({ id: "b", order: 2 }),
        makeActivity({ id: "a", order: 1 }),
      ];

      expect(sortByUserOrder(activities).map((a) => a.id)).toEqual(["a", "b"]);
      expect(hasUserOrder(activities)).toBe(false);
    });

    it("prefers the saved order once the day has been arranged", () => {
      const activities = [
        makeActivity({ id: "a", order: 1, userOrder: 3 }),
        makeActivity({ id: "b", order: 2, userOrder: 1 }),
        makeActivity({ id: "c", order: 3, userOrder: 2 }),
      ];

      expect(sortByUserOrder(activities).map((a) => a.id)).toEqual([
        "b",
        "c",
        "a",
      ]);
      expect(hasUserOrder(activities)).toBe(true);
    });

    it("does not mutate the array it is given", () => {
      const activities = [
        makeActivity({ id: "a", order: 2 }),
        makeActivity({ id: "b", order: 1 }),
      ];

      sortByUserOrder(activities);

      expect(activities.map((a) => a.id)).toEqual(["a", "b"]);
    });
  });

  // The touch fallback: HTML5 drag-and-drop never fires on a phone, so Manual
  // mode could be selected there and then did nothing.
  describe("moveInOrder", () => {
    const order = ["a", "b", "c"];

    it("swaps an activity with the one above it", () => {
      expect(moveInOrder(order, "c", -1)).toEqual(["a", "c", "b"]);
    });

    it("swaps an activity with the one below it", () => {
      expect(moveInOrder(order, "a", 1)).toEqual(["b", "a", "c"]);
    });

    it.each([
      ["the first item up", "a", -1 as const],
      ["the last item down", "c", 1 as const],
      ["an activity that is not in the day", "zzz", 1 as const],
    ])(
      "returns the order unchanged when moving %s",
      (_label, id, direction) => {
        expect(moveInOrder(order, id, direction)).toBe(order);
      },
    );
  });
});
