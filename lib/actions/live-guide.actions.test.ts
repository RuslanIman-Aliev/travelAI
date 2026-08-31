import { requireUserId } from "@/auth";
import { UserFacingError } from "@/lib/errors";
import {
  deleteLiveGuideRoute,
  getUserLiveGuides,
  saveLiveGuideRoute,
} from "@/lib/actions/live-guide.actions";
import { resetRateLimits } from "@/lib/security";
import { prisma } from "@/prisma";

jest.mock("@/prisma", () => ({
  prisma: {
    liveGuide: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("@/auth", () => ({
  requireUserId: jest.fn(),
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const prismaMock = prisma as unknown as {
  liveGuide: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    deleteMany: jest.Mock;
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

  // `LiveGuide` and `LiveGuidePlace` were written on every save and read
  // nowhere, so the saved routes existed only in the database.
  describe("getUserLiveGuides", () => {
    beforeEach(() => {
      prismaMock.liveGuide.findMany.mockResolvedValue([]);
      prismaMock.liveGuide.count.mockResolvedValue(0);
    });

    it("returns only the caller's routes, newest first", async () => {
      await getUserLiveGuides();

      expect(prismaMock.liveGuide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user_1" },
          orderBy: { createdAt: "desc" },
        }),
      );
    });

    it("loads each route's places in the order they were saved", async () => {
      await getUserLiveGuides();

      const args = prismaMock.liveGuide.findMany.mock.calls[0][0];
      expect(args.include).toEqual({
        places: { orderBy: { orderIndex: "asc" } },
      });
    });

    it("clamps an out-of-range page instead of skipping backwards", async () => {
      await getUserLiveGuides(-3, 6);

      const args = prismaMock.liveGuide.findMany.mock.calls[0][0];
      expect(args.skip).toBe(0);
      expect(args.take).toBe(6);
    });

    it("reports a failure instead of throwing at the caller", async () => {
      requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

      await expect(getUserLiveGuides()).resolves.toEqual({
        success: false,
        message: "Unauthorized",
      });
    });
  });

  describe("deleteLiveGuideRoute", () => {
    const ROUTE_ID = "clx0000000000000000000000";

    it("scopes the delete to the owner", async () => {
      prismaMock.liveGuide.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteLiveGuideRoute(ROUTE_ID);

      expect(result).toEqual({ success: true, message: "Route deleted" });
      expect(prismaMock.liveGuide.deleteMany).toHaveBeenCalledWith({
        where: { id: ROUTE_ID, userId: "user_1" },
      });
    });

    it("reports a miss rather than throwing for someone else's route", async () => {
      prismaMock.liveGuide.deleteMany.mockResolvedValue({ count: 0 });

      await expect(deleteLiveGuideRoute(ROUTE_ID)).resolves.toEqual({
        success: false,
        message: "Route not found",
      });
    });

    it("rejects a malformed id before touching the database", async () => {
      const result = await deleteLiveGuideRoute("not-a-cuid");

      expect(result.success).toBe(false);
      expect(prismaMock.liveGuide.deleteMany).not.toHaveBeenCalled();
    });
  });
});
