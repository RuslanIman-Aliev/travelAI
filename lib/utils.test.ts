import { UserFacingError } from "@/lib/errors";
import {
  cn,
  formatError,
  getAIPrompt,
  getPhotoByDestination,
} from "@/lib/utils";
import { Prisma, type Trip } from "@prisma/client";
import { ZodError } from "zod";

describe("cn", () => {
  it("merges class names with tailwind conflict resolution", () => {
    expect(cn("p-2", "p-4", "font-bold")).toBe("p-4 font-bold");
  });
});

describe("formatError", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("returns joined message for Zod errors", () => {
    const error = new ZodError([
      {
        code: "custom",
        message: "Destination is required",
        path: ["destination"],
      },
      { code: "custom", message: "Country is required", path: ["country"] },
    ]);

    expect(formatError(error)).toBe(
      "Destination is required. Country is required",
    );
  });

  it("returns a friendlier duplicate field error for Prisma P2002", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      { code: "P2002", clientVersion: "6.19.1", meta: { target: ["email"] } },
    );

    expect(formatError(error)).toBe("Email already exists");
  });

  it("surfaces messages that were written for the user", () => {
    expect(formatError(new UserFacingError("Unauthorized"))).toBe(
      "Unauthorized",
    );
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("does not leak internal error messages to the caller", () => {
    const error = new Error(
      'Can\'t reach database server at "db.internal:5432"',
    );

    expect(formatError(error)).toBe("An unexpected error occurred");
    expect(consoleError).toHaveBeenCalledWith("Unhandled error:", error);
  });

  it("returns default fallback for unknown values", () => {
    expect(formatError({})).toBe("An unexpected error occurred");
  });
});

describe("getAIPrompt", () => {
  const baseTrip: Trip = {
    id: "trip_1",
    userId: "user_1",
    destination: "Paris",
    country: "France",
    startDate: new Date("2026-05-10"),
    endDate: new Date("2026-05-13"),
    daysCount: 4,
    imageUrl: null,
    budgetMin: 300,
    budgetMax: 900,
    budgetCurrency: "USD",
    interests: ["Museums", "Food"],
    status: "draft",
    aiGenerated: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("injects core trip details into prompt", () => {
    const prompt = getAIPrompt({ trip: baseTrip });

    expect(prompt).toContain("Paris");
    expect(prompt).toContain("France");
    expect(prompt).toContain("4 days");
    expect(prompt).toContain("Museums, Food");
    expect(prompt).toContain("300-900 USD");
    expect(prompt).toContain("RETURN ONLY THIS JSON");
  });

  it("falls back to default interests when interests are missing", () => {
    const prompt = getAIPrompt({ trip: { ...baseTrip, interests: [] } });

    expect(prompt).toContain("General sightseeing, Local culture");
  });

  it("falls back to a standard budget when none was captured", () => {
    const prompt = getAIPrompt({
      trip: {
        ...baseTrip,
        budgetMin: null,
        budgetMax: null,
        budgetCurrency: null,
      },
    });

    expect(prompt).toContain("Moderate/Standard");
  });
});

describe("getPhotoByDestination", () => {
  const originalKey = process.env.PEXELS_API_KEY;

  beforeEach(() => {
    process.env.PEXELS_API_KEY = "test-key";
  });

  afterEach(() => {
    process.env.PEXELS_API_KEY = originalKey;
    jest.restoreAllMocks();
  });

  const mockFetch = (impl: jest.Mock) => {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
      impl as unknown as typeof fetch;
    return impl;
  };

  it("returns the first image URL when Pexels responds with photos", async () => {
    const fetchMock = mockFetch(
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          photos: [{ src: { large2x: "https://img.test/photo.jpg" } }],
        }),
      }),
    );

    await expect(getPhotoByDestination("New York")).resolves.toBe(
      "https://img.test/photo.jpg",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("query=New%20York"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "test-key" }),
      }),
    );
  });

  it("returns null when the API has no photos", async () => {
    mockFetch(
      jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ photos: [] }) }),
    );

    await expect(getPhotoByDestination("Unknown Place")).resolves.toBeNull();
  });

  it("returns null when the API responds with an error status", async () => {
    mockFetch(jest.fn().mockResolvedValue({ ok: false, status: 429 }));

    await expect(getPhotoByDestination("Rome")).resolves.toBeNull();
  });

  it("returns null - never an object - when fetch throws", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetch(jest.fn().mockRejectedValue(new Error("network")));

    // Regression guard: this used to resolve to `{ success: false }`, which was
    // then written straight into the `imageUrl` string column.
    await expect(getPhotoByDestination("Rome")).resolves.toBeNull();
  });

  it("returns null when no API key is configured", async () => {
    delete process.env.PEXELS_API_KEY;
    const fetchMock = mockFetch(jest.fn());

    await expect(getPhotoByDestination("Rome")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
