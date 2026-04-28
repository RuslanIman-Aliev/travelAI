import {
  aiTripResponseSchema,
  formSchema,
  insertTripSchema,
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
