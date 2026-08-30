import { prisma } from "@/prisma";

const generateContentMock = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
  ThinkingLevel: {
    THINKING_LEVEL_UNSPECIFIED: "THINKING_LEVEL_UNSPECIFIED",
    MINIMAL: "MINIMAL",
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
  },
}));

// Capture the handler `createFunction` is given so it can be driven directly,
// with `step.run` collapsed to "just call the body".
let handler: (args: {
  event: { data: { tripId: string } };
  step: { run: (name: string, fn: () => unknown) => unknown };
}) => Promise<unknown>;

jest.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      _config: unknown,
      fn: (args: {
        event: { data: { tripId: string } };
        step: { run: (name: string, body: () => unknown) => unknown };
      }) => Promise<unknown>,
    ) => {
      handler = fn;
      return { id: "generate-trip-itinerary" };
    },
  },
}));

jest.mock("@/prisma", () => ({
  prisma: {
    trip: { findUnique: jest.fn(), update: jest.fn() },
    day: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const photoMock = jest.fn();
jest.mock("@/lib/utils", () => {
  const actual = jest.requireActual("@/lib/utils");
  return {
    ...actual,
    getPhotoByDestination: (...args: unknown[]) => photoMock(...args),
  };
});

const prismaMock = prisma as unknown as {
  trip: { findUnique: jest.Mock; update: jest.Mock };
  day: { create: jest.Mock };
  $transaction: jest.Mock;
};

const step = { run: (_name: string, fn: () => unknown) => fn() };

const trip = {
  id: "trip_1",
  userId: "user_1",
  destination: "Paris",
  country: "France",
  startDate: new Date("2026-06-10"),
  endDate: new Date("2026-06-11"),
  daysCount: 2,
  imageUrl: null,
  budgetMin: 100,
  budgetMax: 500,
  budgetCurrency: "USD",
  interests: ["Food"],
  status: "generating",
  aiGenerated: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const validItinerary = {
  title: "Paris",
  currency: "EUR",
  itinerary: [
    {
      dayNumber: 1,
      date: "2026-06-10",
      summary: "Centre",
      activities: [
        {
          time: "09:00",
          title: "Louvre",
          placeName: "Louvre Museum",
          placeType: "Culture",
          description: "Art and history",
          latitude: 48.8606,
          longitude: 2.3376,
          estimatedCost: "22 EUR",
        },
      ],
    },
  ],
};

/** `@google/genai` exposes `text` as a getter, not `response.text()`. */
const respondWith = (payload: unknown) =>
  generateContentMock.mockResolvedValue({
    text: JSON.stringify(payload),
    usageMetadata: {
      promptTokenCount: 900,
      thoughtsTokenCount: 120,
      candidatesTokenCount: 340,
      totalTokenCount: 1360,
    },
  });

const run = () => handler({ event: { data: { tripId: "trip_1" } }, step });

describe("generateTripFunction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The generation step logs its token/latency breakdown on every run.
    jest.spyOn(console, "info").mockImplementation(() => {});
    // Re-import so `createFunction` re-registers `handler` against the fresh mocks.
    jest.isolateModules(() => {
      jest.requireActual("@/lib/inngest/functions");
    });
    prismaMock.trip.findUnique.mockResolvedValue(trip);
    prismaMock.day.create.mockImplementation((args: unknown) => args);
    prismaMock.$transaction.mockResolvedValue([]);
    photoMock.mockResolvedValue("https://img.test/paris.jpg");
  });

  it("persists days and the trip status in one transaction", async () => {
    respondWith(validItinerary);

    await expect(run()).resolves.toEqual({ success: true, tripId: "trip_1" });

    // Both the day inserts and the status flip go through a single call, so a
    // retry cannot leave a trip with days but no `generated` status.
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const operations = prismaMock.$transaction.mock.calls[0][0];
    expect(operations).toHaveLength(2);
    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: "trip_1" },
      data: {
        aiGenerated: true,
        status: "generated",
        imageUrl: "https://img.test/paris.jpg",
      },
    });
  });

  it("parses the model's cost text into minor units at ingestion", async () => {
    respondWith(validItinerary);

    await run();

    const dayArgs = prismaMock.day.create.mock.calls[0][0];
    expect(dayArgs.data.activities.create[0]).toMatchObject({
      estimatedCostCents: 2200,
      estimatedCostCurrency: "EUR",
      estimatedCostIsFree: false,
    });
  });

  it("marks free activities instead of storing a zero amount silently", async () => {
    respondWith({
      ...validItinerary,
      itinerary: [
        {
          ...validItinerary.itinerary[0],
          activities: [
            {
              ...validItinerary.itinerary[0].activities[0],
              estimatedCost: "Free",
            },
          ],
        },
      ],
    });

    await run();

    const dayArgs = prismaMock.day.create.mock.calls[0][0];
    expect(dayArgs.data.activities.create[0]).toMatchObject({
      estimatedCostCents: 0,
      estimatedCostIsFree: true,
    });
  });

  it("nulls out coordinates that are not a valid pair", async () => {
    respondWith({
      ...validItinerary,
      itinerary: [
        {
          ...validItinerary.itinerary[0],
          activities: [
            {
              ...validItinerary.itinerary[0].activities[0],
              latitude: 999,
              longitude: 2.3376,
            },
          ],
        },
      ],
    });

    await run();

    const dayArgs = prismaMock.day.create.mock.calls[0][0];
    expect(dayArgs.data.activities.create[0]).toMatchObject({
      latitude: null,
      longitude: null,
    });
  });

  it("marks the trip failed and does not retry when the location is invalid", async () => {
    respondWith({ error: "Location not found" });

    await expect(run()).rejects.toThrow("Invalid Location: Location not found");

    expect(prismaMock.trip.update).toHaveBeenCalledWith({
      where: { id: "trip_1" },
      data: { status: "failed", aiGenerated: false },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a response that does not match the itinerary schema", async () => {
    respondWith({
      ...validItinerary,
      itinerary: [
        {
          ...validItinerary.itinerary[0],
          activities: [
            {
              ...validItinerary.itinerary[0].activities[0],
              placeType: "Nightlife",
            },
          ],
        },
      ],
    });

    await expect(run()).rejects.toThrow(
      "AI response did not match itinerary schema",
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a response that is not valid JSON", async () => {
    generateContentMock.mockResolvedValue({ text: "here is your trip!" });

    await expect(run()).rejects.toThrow("AI response was not valid JSON");
  });

  it("reports an empty response with its finish reason", async () => {
    generateContentMock.mockResolvedValue({
      text: undefined,
      candidates: [{ finishReason: "MAX_TOKENS" }],
    });

    await expect(run()).rejects.toThrow(
      "AI returned no content (finishReason: MAX_TOKENS)",
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  describe("request configuration", () => {
    const configOf = () => generateContentMock.mock.calls[0][0].config;

    it("caps thinking, constrains decoding and bounds the output", async () => {
      respondWith(validItinerary);

      await run();

      const config = configOf();
      expect(config.thinkingConfig).toEqual({ thinkingLevel: "LOW" });
      expect(config.responseMimeType).toBe("application/json");
      expect(config.maxOutputTokens).toBeGreaterThan(0);
      // trip.daysCount is 2 -> 2048 + 2 * 2048
      expect(config.maxOutputTokens).toBe(6_144);
    });

    it("sends a schema that permits both the itinerary and the error escape hatch", async () => {
      respondWith(validItinerary);

      await run();

      const schema = configOf().responseJsonSchema;
      expect(schema.anyOf).toHaveLength(2);
      // Unsupported keywords would make Gemini reject the whole request.
      expect(JSON.stringify(schema)).not.toContain("minLength");
      expect(JSON.stringify(schema)).not.toContain("$schema");
    });
  });

  it("still writes the itinerary when the destination photo is unavailable", async () => {
    respondWith(validItinerary);
    photoMock.mockResolvedValue(null);

    await run();

    expect(prismaMock.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: null }),
      }),
    );
  });

  it("does not retry when the trip no longer exists", async () => {
    prismaMock.trip.findUnique.mockResolvedValue(null);

    await expect(run()).rejects.toThrow("Trip not found: trip_1");
    expect(generateContentMock).not.toHaveBeenCalled();
  });
});
