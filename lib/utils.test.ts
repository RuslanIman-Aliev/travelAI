import { Prisma, type Trip } from "@prisma/client";
import { ZodError } from "zod";
import {
  cn,
  formatError,
  getAIPrompt,
  getPhotoByDestination,
} from "@/lib/utils";

describe("cn", () => {
  it("merges class names with tailwind conflict resolution", () => {
    expect(cn("p-2", "p-4", "font-bold")).toBe("p-4 font-bold");
  });
});

describe("formatError", () => {
  it("returns joined message for Zod errors", () => {
    const error = new ZodError([
      {
        code: "custom",
        message: "Destination is required",
        path: ["destination"],
      },
      {
        code: "custom",
        message: "Country is required",
        path: ["country"],
      },
    ]);

    expect(formatError(error)).toBe(
      "Destination is required. Country is required",
    );
  });

  it("returns a friendlier duplicate field error for Prisma P2002", () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "6.19.1",
        meta: { target: ["email"] },
      },
    );

    expect(formatError(error)).toBe("Email already exists");
  });

  it("returns message for generic Error", () => {
    expect(formatError(new Error("Unexpected failure"))).toBe(
      "Unexpected failure",
    );
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
    budget: "300-900",
    interests: ["Museums", "Food"],
    status: "draft",
    aiGenerated: false,
    isPublic: false,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  it("injects core trip details into prompt", () => {
    const prompt = getAIPrompt({ trip: baseTrip });

    expect(prompt).toContain("Paris");
    expect(prompt).toContain("France");
    expect(prompt).toContain("4 days");
    expect(prompt).toContain("Museums, Food");
    expect(prompt).toContain("300-900");
    expect(prompt).toContain("RETURN ONLY THIS JSON");
  });

  it("falls back to default interests when interests are missing", () => {
    const prompt = getAIPrompt({
      trip: { ...baseTrip, interests: [] },
    });

    expect(prompt).toContain("General sightseeing, Local culture");
  });
});

describe("getPhotoByDestination", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it("returns the first image URL when Pexels responds with photos", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({
        photos: [{ src: { large2x: "https://img.test/photo.jpg" } }],
      }),
    } as Response);
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
      fetchMock as typeof fetch;

    const result = await getPhotoByDestination("New York");

    expect(result).toBe("https://img.test/photo.jpg");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("query=New%20York"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String),
        }),
      }),
    );
  });

  it("returns null when API has no photos", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      json: async () => ({ photos: [] }),
    } as Response);
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
      fetchMock as typeof fetch;

    const result = await getPhotoByDestination("Unknown Place");

    expect(result).toBeNull();
  });

  it("returns a failure object when fetch throws", async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error("network"));
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch =
      fetchMock as typeof fetch;

    const result = await getPhotoByDestination("Rome");

    expect(result).toEqual({
      success: false,
      message: "Failed to fetch photo",
    });
  });
});
