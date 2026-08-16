import { requireUserId } from "@/auth";
import { UserFacingError } from "@/lib/errors";
import { saveLiveGuideRoute } from "@/lib/actions/live-guide.actions";
import { resetRateLimits } from "@/lib/security";
import { prisma } from "@/prisma";

jest.mock("@/prisma", () => ({
  prisma: {
    liveGuide: {
      create: jest.fn(),
    },
  },
}));

jest.mock("@/auth", () => ({
  requireUserId: jest.fn(),
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const prismaMock = prisma as unknown as {
  liveGuide: {
    create: jest.Mock;
  };
};

describe("live-guide.actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    requireUserIdMock.mockResolvedValue("user_1");
  });

  it("persists live guide route with mapped places", async () => {
    prismaMock.liveGuide.create.mockResolvedValue({ id: "lg_1" });

    const result = await saveLiveGuideRoute({
      location: "Paris, France",
      coords: { lat: 48.8566, lng: 2.3522 },
      radiusNumber: 3000,
      mapLink: "https://www.google.com/maps/dir/?api=1",
      selectedPlaces: [
        {
          id: "place_1",
          name: "Louvre Museum",
          address: "Rue de Rivoli",
          category: "museum",
          rating: 4.8,
          userRatingCount: 100,
          location: { lat: 48.8606, lng: 2.3376 },
          distance: 1.2,
        },
        {
          id: "place_2",
          name: "Eiffel Tower",
          address: "Champ de Mars",
          category: "landmark",
          rating: 4.7,
          userRatingCount: 200,
          location: { lat: 48.8584, lng: 2.2945 },
          distance: 2.8,
        },
      ],
    });

    expect(result).toEqual({ success: true });
    expect(prismaMock.liveGuide.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          startAddress: "Paris, France",
          radiusMeters: 3000,
          places: {
            create: [
              expect.objectContaining({
                googlePlaceId: "place_1",
                orderIndex: 0,
              }),
              expect.objectContaining({
                googlePlaceId: "place_2",
                orderIndex: 1,
              }),
            ],
          },
        }),
      }),
    );
  });

  it("returns a generic message when persistence fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    prismaMock.liveGuide.create.mockRejectedValue(new Error("Write failed"));

    const result = await saveLiveGuideRoute({
      location: "Paris, France",
      coords: { lat: 48.8566, lng: 2.3522 },
      radiusNumber: 3000,
      mapLink: "https://www.google.com/maps/dir/?api=1",
      selectedPlaces: [
        {
          id: "place_1",
          name: "Louvre Museum",
          address: "Rue de Rivoli",
          category: "museum",
          rating: 4.8,
          userRatingCount: 100,
          location: { lat: 48.8606, lng: 2.3376 },
          distance: 1.2,
        },
      ],
    });

    expect(result).toEqual({
      success: false,
      message: "An unexpected error occurred",
    });
  });

  it("rejects an unauthenticated caller before touching the database", async () => {
    requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

    const result = await saveLiveGuideRoute({
      location: "Paris, France",
      coords: { lat: 48.8566, lng: 2.3522 },
      radiusNumber: 3000,
      mapLink: "https://www.google.com/maps/dir/?api=1",
      selectedPlaces: [
        {
          id: "place_1",
          name: "Louvre Museum",
          address: "Rue de Rivoli",
          category: "museum",
          rating: 4.8,
          userRatingCount: 100,
          location: { lat: 48.8606, lng: 2.3376 },
          distance: 1.2,
        },
      ],
    });

    expect(result).toEqual({ success: false, message: "Unauthorized" });
    expect(prismaMock.liveGuide.create).not.toHaveBeenCalled();
  });
});
