import { PLACE_TYPE_LABELS } from "@/lib/place-types";
import {
  aiActivitySchema,
  aiTripResponseSchema,
  formSchema,
  insertTripSchema,
  liveGuideRouteSchema,
  MAX_TRIP_DAYS,
  tripDaysCount,
  webUrlSchema,
} from "@/lib/validators";

describe("insertTripSchema", () => {
  it("accepts valid trip payload", () => {
    const result = insertTripSchema.safeParse({
      destination: "Tokyo",
      country: "Japan",
      startDate: new Date("2026-07-10"),
      endDate: new Date("2026-07-15"),
      interests: ["Food", "Museums"],
      budget: [1000, 2500],
    });

    expect(result.success).toBe(true);
  });

  it("requires destination", () => {
    const result = insertTripSchema.safeParse({
      destination: "",
      country: "Japan",
      startDate: new Date("2026-07-10"),
      endDate: new Date("2026-07-15"),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.destination?.[0]).toBe(
        "Destination is required",
      );
    }
  });

  it("requires budget range with exactly two values when budget is provided", () => {
    const result = insertTripSchema.safeParse({
      destination: "Madrid",
      country: "Spain",
      startDate: new Date("2026-08-01"),
      endDate: new Date("2026-08-05"),
      budget: [500],
    });

    expect(result.success).toBe(false);
  });

  // The length limit, the persisted `daysCount` and the bound on the model
  // response all have to mean the same thing. They did not: a 31-day trip passed
  // validation, asked Gemini for 31 days, and then failed `safeParse` on every
  // retry because the response schema stops at 30.
  describe("trip length boundary", () => {
    const start = new Date("2026-06-01");
    const endAfter = (days: number) =>
      new Date(start.getTime() + (days - 1) * 24 * 60 * 60 * 1000);

    const parseWithLength = (days: number) =>
      insertTripSchema.safeParse({
        destination: "Tokyo",
        country: "Japan",
        startDate: start,
        endDate: endAfter(days),
      });

    it("counts both endpoints as days", () => {
      expect(tripDaysCount(start, endAfter(1))).toBe(1);
      expect(tripDaysCount(start, endAfter(29))).toBe(29);
      expect(tripDaysCount(start, endAfter(MAX_TRIP_DAYS))).toBe(MAX_TRIP_DAYS);
    });

    it("accepts 29 and 30 day trips", () => {
      expect(parseWithLength(29).success).toBe(true);
      expect(parseWithLength(MAX_TRIP_DAYS).success).toBe(true);
    });

    it("rejects a 31 day trip instead of letting it die in generation", () => {
      const result = parseWithLength(MAX_TRIP_DAYS + 1);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.endDate?.[0]).toBe(
          `Trips are limited to ${MAX_TRIP_DAYS} days`,
        );
      }
    });

    it("never admits a length the response schema would reject", () => {
      const longest = tripDaysCount(start, endAfter(MAX_TRIP_DAYS));

      const itinerary = Array.from({ length: longest }, (_, index) => ({
        dayNumber: index + 1,
        date: `2026-06-${String(index + 1).padStart(2, "0")}`,
        summary: "Day",
        activities: [
          {
            time: "09:00",
            title: "Walk",
            placeType: "Sightseeing",
            description: "A walk",
            latitude: 35.6,
            longitude: 139.7,
          },
        ],
      }));

      expect(aiTripResponseSchema.safeParse({ itinerary }).success).toBe(true);
    });
  });
});

describe("formSchema", () => {
  const validPlace = {
    id: "place_1",
    address: "Main Street 1",
    name: "City Museum",
    category: "museum",
    rating: 4.7,
    userRatingCount: 120,
    location: {
      lat: 35.7,
      lng: 139.7,
    },
  };

  it("accepts valid live guide form payload", () => {
    const result = formSchema.safeParse({
      location: "Tokyo, Japan",
      radius: "3 km",
      selectedPlaces: [validPlace],
    });

    expect(result.success).toBe(true);
  });

  it("requires radius", () => {
    const result = formSchema.safeParse({
      location: "Tokyo, Japan",
      radius: "",
      selectedPlaces: [validPlace],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.radius?.[0]).toBe(
        "Radius is required",
      );
    }
  });

  it("requires at least one selected place", () => {
    const result = formSchema.safeParse({
      location: "Tokyo, Japan",
      radius: "3 km",
      selectedPlaces: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.selectedPlaces?.[0]).toBe(
        "Select at least one place to visit",
      );
    }
  });
});

describe("aiTripResponseSchema", () => {
  const validPayload = {
    title: "Paris in 2 days",
    currency: "EUR",
    itinerary: [
      {
        dayNumber: 1,
        date: "2026-06-10",
        summary: "City center highlights",
        activities: [
          {
            time: "09:00",
            title: "Louvre Museum",
            placeName: "Louvre Museum",
            placeType: "Culture",
            description: "Art masterpieces and iconic exhibits",
            latitude: 48.8606,
            longitude: 2.3376,
            estimatedCost: "22 EUR",
          },
        ],
      },
    ],
  };

  it("accepts valid AI trip payload", () => {
    const result = aiTripResponseSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects unknown place type", () => {
    const result = aiTripResponseSchema.safeParse({
      ...validPayload,
      itinerary: [
        {
          ...validPayload.itinerary[0],
          activities: [
            {
              ...validPayload.itinerary[0].activities[0],
              placeType: "Nightlife",
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one itinerary day and one activity", () => {
    const noDays = aiTripResponseSchema.safeParse({
      ...validPayload,
      itinerary: [],
    });
    expect(noDays.success).toBe(false);

    const noActivities = aiTripResponseSchema.safeParse({
      ...validPayload,
      itinerary: [
        {
          ...validPayload.itinerary[0],
          activities: [],
        },
      ],
    });
    expect(noActivities.success).toBe(false);
  });
});

describe("webUrlSchema", () => {
  it("accepts http and https links", () => {
    expect(webUrlSchema.safeParse("https://maps.google.com/?q=1").success).toBe(
      true,
    );
    expect(webUrlSchema.safeParse("http://example.test/route").success).toBe(
      true,
    );
  });

  // The regression: `z.url()` on its own validates the shape of a URL and lets
  // every protocol through, so these all passed before the protocol check.
  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ])("rejects %s", (value) => {
    expect(webUrlSchema.safeParse(value).success).toBe(false);
  });

  it("rejects a script-protocol link inside a saved route", () => {
    const result = liveGuideRouteSchema.safeParse({
      location: "Berlin",
      coords: { lat: 52.52, lng: 13.405 },
      radiusNumber: 3000,
      selectedPlaces: [
        {
          id: "place_1",
          name: "Museum",
          address: "Museumsinsel",
          category: "museum",
          rating: 4.6,
          location: { lat: 52.52, lng: 13.4 },
        },
      ],
      mapLink: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
  });
});

describe("aiActivitySchema place types", () => {
  it("accepts every label from the canonical list", () => {
    for (const label of PLACE_TYPE_LABELS) {
      const result = aiActivitySchema.safeParse({
        time: "09:00",
        placeType: label,
        description: "Something to do",
        latitude: 1,
        longitude: 2,
      });

      expect(result.success).toBe(true);
    }
  });

  it("rejects a type the UI has no rendering for", () => {
    const result = aiActivitySchema.safeParse({
      time: "09:00",
      placeType: "Nightlife",
      description: "Something to do",
      latitude: 1,
      longitude: 2,
    });

    expect(result.success).toBe(false);
  });
});
