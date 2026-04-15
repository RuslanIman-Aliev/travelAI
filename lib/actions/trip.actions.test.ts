import { auth } from "@/auth";
import {
  getTripById,
  getUserStatictics,
  getUserTrips,
  insertTrip,
} from "@/lib/actions/trip.actions";
import { prisma } from "@/prisma";

jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/prisma", () => ({
  prisma: {
    trip: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const authMock = auth as jest.MockedFunction<typeof auth>;
const prismaMock = prisma as unknown as {
  trip: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

describe("trip.actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("insertTrip", () => {
    it("returns unauthorized when no session is available", async () => {
      authMock.mockResolvedValue(null);

      const result = await insertTrip({
        destination: "Paris",
        country: "France",
        startDate: new Date("2026-06-10"),
        endDate: new Date("2026-06-12"),
        interests: ["Museums"],
        budget: [200, 800],
      });

      expect(result).toEqual({
        success: false,
        message: "Unauthorized",
      });
      expect(prismaMock.trip.create).not.toHaveBeenCalled();
    });

    it("creates a trip with transformed budget and calculated days", async () => {
      authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });

      const result = await insertTrip({
        destination: "Paris",
        country: "France",
        startDate: new Date("2026-06-10"),
        endDate: new Date("2026-06-12"),
        interests: ["Museums", "Food"],
        budget: [200, 800],
      });

      expect(result).toEqual({
        success: true,
        message: "Trip created successfully",
        tripId: "trip_1",
      });
      expect(prismaMock.trip.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          destination: "Paris",
          country: "France",
          budget: "200-800",
          daysCount: 3,
          userId: "user_1",
        }),
      });
    });

    it("returns zod validation message for invalid payload", async () => {
      authMock.mockResolvedValue({ user: { id: "user_1" } } as never);

      const result = await insertTrip({
        destination: "",
        country: "France",
        startDate: new Date("2026-06-10"),
        endDate: new Date("2026-06-12"),
        interests: ["Museums"],
        budget: [200, 800],
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Destination is required");
    });
  });

  describe("getTripById", () => {
    it("returns user not found when no auth session", async () => {
      authMock.mockResolvedValue(null);

      const result = await getTripById("trip_1");

      expect(result).toEqual({ success: false, message: "User not found" });
      expect(prismaMock.trip.findFirst).not.toHaveBeenCalled();
    });

    it("returns trip not found when trip is missing", async () => {
      authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
      prismaMock.trip.findFirst.mockResolvedValue(null);

      const result = await getTripById("missing_trip");

      expect(result).toEqual({ success: false, message: "Trip not found" });
      expect(prismaMock.trip.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "missing_trip",
            userId: "user_1",
          },
        }),
      );
    });

    it("returns trip with success when found", async () => {
      authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
      const trip = { id: "trip_1", destination: "Paris", tripDays: [] };
      prismaMock.trip.findFirst.mockResolvedValue(trip);

      const result = await getTripById("trip_1");

      expect(result).toEqual({ success: true, trip });
    });
  });

  describe("getUserTrips", () => {
    it("queries trips using provided filters", async () => {
      prismaMock.trip.findMany.mockResolvedValue([{ id: "trip_1" }]);

      const result = await getUserTrips("user_1", "generated", true);

      expect(result).toEqual({
        success: true,
        trips: [{ id: "trip_1" }],
      });
      expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user_1",
          status: "generated",
          aiGenerated: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    });

    it("returns formatted error when trip lookup fails", async () => {
      prismaMock.trip.findMany.mockRejectedValue(
        new Error("DB is unavailable"),
      );

      const result = await getUserTrips("user_1");

      expect(result).toEqual({
        success: false,
        message: "DB is unavailable",
      });
    });
  });

  describe("getUserStatictics", () => {
    it("returns aggregated statistics", async () => {
      prismaMock.trip.count.mockResolvedValue(3);
      prismaMock.trip.findMany
        .mockResolvedValueOnce([{ country: "France" }, { country: "Spain" }])
        .mockResolvedValueOnce([
          { destination: "Paris" },
          { destination: "Madrid" },
          { destination: "Barcelona" },
        ]);

      const result = await getUserStatictics("user_1");

      expect(result).toEqual({
        success: true,
        tripsCount: 3,
        countries: 2,
        cities: 3,
      });
      expect(prismaMock.trip.count).toHaveBeenCalledWith({
        where: {
          userId: "user_1",
          aiGenerated: true,
        },
      });
    });
  });
});
