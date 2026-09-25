import { MAX_TRIP_DAYS } from "@/lib/validators";
import { prisma } from "@/prisma";
import { NonRetriableError } from "inngest";

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
  FinishReason: {
    STOP: "STOP",
    MAX_TOKENS: "MAX_TOKENS",
    SAFETY: "SAFETY",
  },
}));

// Capture the handler `createFunction` is given so it can be driven directly,
// with `step.run` collapsed to "just call the body". The config is captured too:
// `onFailure` is the terminal state for a run that ran out of retries, and it is
// only reachable through there.
let handler: (args: {
  event: { data: { tripId: string } };
  step: { run: (name: string, fn: () => unknown) => unknown };
}) => Promise<unknown>;

type FailureArgs = {
  event: { data: { run_id?: string; event?: { data?: { tripId?: string } } } };
  error: Error;
};

let config: { onFailure?: (args: FailureArgs) => Promise<unknown> };

jest.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: (
      fnConfig: { onFailure?: (args: FailureArgs) => Promise<unknown> },
      fn: (args: {
        event: { data: { tripId: string } };
        step: { run: (name: string, body: () => unknown) => unknown };
      }) => Promise<unknown>,
    ) => {
      config = fnConfig;
      handler = fn;
      return { id: "generate-trip-itinerary" };
    },
  },
}));

jest.mock("@/prisma", () => ({
  prisma: {
    trip: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
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
  trip: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
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
      data: { status: "failed" },
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

    // The message has to name the field: the response is gone by the time
    // anyone reads the failed run, so a bare "did not match" is unactionable.
    await expect(run()).rejects.toThrow(
      /AI response did not match itinerary schema: itinerary\[0\]\.activities\[0\]\.placeType: /,
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
      candidates: [{ finishReason: "SAFETY" }],
    });

    await expect(run()).rejects.toThrow(
      "AI returned no content (finishReason: SAFETY)",
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("does not retry a response truncated by the output ceiling", async () => {
    // Truncation is deterministic: the same prompt produces the same length, so
    // the remaining retries would each spend a full generation to fail here
    // again. It has to be non-retriable, and the message has to name the limit.
    generateContentMock.mockResolvedValue({
      text: '{"itinerary":[{"dayNumb',
      candidates: [{ finishReason: "MAX_TOKENS" }],
    });

    // Asserted by name rather than by `instanceof`: the handler is re-imported
    // through `isolateModules`, so it throws a different copy of the class than
    // this file holds. The name is also what Inngest itself reads off a
    // serialised error to decide whether to retry.
    await expect(run()).rejects.toMatchObject({
      name: NonRetriableError.name,
      message: expect.stringContaining("output-token ceiling for a 2-day trip"),
    });
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
      // Derived from the response schema's own bounds: envelope + days *
      // (day envelope + MAX_ACTIVITIES_PER_DAY * per-activity). For the 2-day
      // fixture that is 256 + 2 * (64 + 20 * 120).
      expect(config.maxOutputTokens).toBe(5_184);
    });

    it("keeps the ceiling above what the schema permits for the longest trip", async () => {
      // The regression this guards: the old ceiling was a flat 32_768, which is
      // less than a 30-day itinerary can legally contain, so our own cap
      // truncated a valid response and burned every retry.
      prismaMock.trip.findUnique.mockResolvedValue({
        ...trip,
        daysCount: MAX_TRIP_DAYS,
      });
      respondWith(validItinerary);

      await run();

      expect(configOf().maxOutputTokens).toBeGreaterThan(32_768);
    });

    it("sends a schema that permits both the itinerary and the error escape hatch", async () => {
      respondWith(validItinerary);

      await run();

      const schema = configOf().responseJsonSchema;
      expect(schema.anyOf).toHaveLength(2);
      // Unsupported keywords would make Gemini reject the whole request.
      expect(JSON.stringify(schema)).not.toContain("minLength");
      expect(JSON.stringify(schema)).not.toContain("$schema");
      // Rejected with 400 for arrays nested in arrays, which is this response.
      expect(JSON.stringify(schema)).not.toContain("minItems");
      expect(JSON.stringify(schema)).not.toContain("maxItems");
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

  // Without this the only failure that ever wrote a terminal status was the
  // "unknown destination" branch. Everything else - timeout, MAX_TOKENS, bad
  // JSON, schema mismatch - left the trip in `generating` with no way out.
  describe("onFailure", () => {
    const fail = (
      data: { run_id?: string; event?: { data?: { tripId?: string } } },
      error = new Error("AI response was not valid JSON"),
    ) => config.onFailure?.({ event: { data }, error });

    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
    });

    it("settles a trip that ran out of retries into `failed`", async () => {
      await fail({ run_id: "run_1", event: { data: { tripId: "trip_1" } } });

      expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
        where: { id: "trip_1", status: "generating" },
        data: { status: "failed" },
      });
    });

    it("only settles a trip that is still generating", async () => {
      await fail({ run_id: "run_1", event: { data: { tripId: "trip_1" } } });

      // A run that already reached `generated` must not be dragged back, so the
      // status is part of the predicate rather than a bare id update.
      const where = prismaMock.trip.updateMany.mock.calls[0][0].where;
      expect(where.status).toBe("generating");
    });

    it("does nothing when the failure event carries no trip id", async () => {
      await fail({ run_id: "run_1", event: { data: {} } });

      expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
    });
  });
});
