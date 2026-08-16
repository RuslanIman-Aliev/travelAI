import { requireUserId } from "@/auth";
import { UserFacingError } from "@/lib/errors";
import {
  getTripById,
  getUserStatistics,
  getUserTrips,
  insertTrip,
} from "@/lib/actions/trip.actions";
import { resetRateLimits } from "@/lib/security";
import { prisma } from "@/prisma";

jest.mock("@/auth", () => ({ requireUserId: jest.fn() }));

jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }));

jest.mock("@/prisma", () => ({
  prisma: {
    trip: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  },
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const prismaMock = prisma as unknown as {
  trip: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
  };
};

const validTrip = {
  destination: "Paris",
  country: "France",
  startDate: new Date("2026-06-10"),
  endDate: new Date("2026-06-12"),
  interests: ["Museums"],
  budget: [200, 800],
};

describe("trip.actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    requireUserIdMock.mockResolvedValue("user_1");
  });

  describe("insertTrip", () => {
    it("returns unauthorized when there is no session", async () => {
      requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

      const result = await insertTrip(validTrip);

      expect(result).toEqual({ success: false, message: "Unauthorized" });
      expect(prismaMock.trip.create).not.toHaveBeenCalled();
    });

    it("stores a structured budget and the calculated day count", async () => {
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });

      const result = await insertTrip(validTrip);

      expect(result).toEqual({
        success: true,
        message: "Trip created successfully",
        tripId: "trip_1",
      });
      expect(prismaMock.trip.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            destination: "Paris",
            country: "France",
            budgetMin: 200,
            budgetMax: 800,
            budgetCurrency: "USD",
            daysCount: 3,
            userId: "user_1",
          }),
        }),
      );
    });

    it("returns the zod validation message for an invalid payload", async () => {
      const result = await insertTrip({ ...validTrip, destination: "" });

      expect(result.success).toBe(false);
      expect(result.success === false && result.message).toContain(
        "Destination is required",
      );
      expect(prismaMock.trip.create).not.toHaveBeenCalled();
    });

    it("rejects an end date before the start date", async () => {
      const result = await insertTrip({
        ...validTrip,
        startDate: new Date("2026-06-12"),
        endDate: new Date("2026-06-10"),
      });

      expect(result.success).toBe(false);
      expect(result.success === false && result.message).toContain(
        "End date must be on or after the start date",
      );
      expect(prismaMock.trip.create).not.toHaveBeenCalled();
    });

    it("rejects a trip longer than the supported window", async () => {
      const result = await insertTrip({
        ...validTrip,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-08-01"),
      });

      expect(result.success).toBe(false);
      expect(result.success === false && result.message).toContain(
        "limited to 30 days",
      );
    });

    it("rate limits repeated creations by the same user", async () => {
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });

      for (let i = 0; i < 5; i += 1) {
        await insertTrip(validTrip);
      }
      const blocked = await insertTrip(validTrip);

      expect(blocked.success).toBe(false);
      expect(blocked.success === false && blocked.message).toContain(
        "Too many trip creation requests",
      );
      expect(prismaMock.trip.create).toHaveBeenCalledTimes(5);
    });
  });

  describe("getTripById", () => {
    it("returns unauthorized when there is no session", async () => {
      requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

      const result = await getTripById("trip_unauthenticated");

      expect(result).toEqual({ success: false, message: "Unauthorized" });
      expect(prismaMock.trip.findFirst).not.toHaveBeenCalled();
    });

    it("scopes the lookup to the owner and reports a miss", async () => {
      prismaMock.trip.findFirst.mockResolvedValue(null);

      const result = await getTripById("missing_trip");

      expect(result).toEqual({ success: false, message: "Trip not found" });
      expect(prismaMock.trip.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "missing_trip", userId: "user_1" },
        }),
      );
    });

    it("returns the trip when found", async () => {
      const trip = { id: "trip_found", destination: "Paris", tripDays: [] };
      prismaMock.trip.findFirst.mockResolvedValue(trip);

      await expect(getTripById("trip_found")).resolves.toEqual({
        success: true,
        trip,
      });
    });
  });

  describe("getUserTrips", () => {
    beforeEach(() => {
      prismaMock.trip.findMany.mockResolvedValue([{ id: "trip_1" }]);
      prismaMock.trip.count.mockResolvedValue(13);
    });

    it("queries trips using the provided filters and pagination", async () => {
      const result = await getUserTrips("generated", true, 2, 6);

      expect(result).toEqual({
        success: true,
        trips: [{ id: "trip_1" }],
        pagination: {
          totalCount: 13,
          totalPages: 3,
          currentPage: 2,
          limit: 6,
        },
      });
      expect(prismaMock.trip.findMany).toHaveBeenCalledWith({
        where: { userId: "user_1", status: "generated", aiGenerated: true },
        orderBy: { createdAt: "desc" },
        skip: 6,
        take: 6,
      });
    });

    it("clamps a negative page instead of producing a negative skip", async () => {
      const result = await getUserTrips(undefined, undefined, -5, 10);

      expect(result.success && result.pagination.currentPage).toBe(1);
      expect(prismaMock.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it("caps an oversized page size", async () => {
      await getUserTrips(undefined, undefined, 1, 100_000);

      expect(prismaMock.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("returns a generic message when the query fails", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      prismaMock.trip.findMany.mockRejectedValue(
        new Error('Can\'t reach database server at "db.internal:5432"'),
      );

      const result = await getUserTrips();

      expect(result).toEqual({
        success: false,
        message: "An unexpected error occurred",
      });
    });
  });

  describe("getUserStatistics", () => {
    it("aggregates counts using distinct groupings", async () => {
      prismaMock.trip.count.mockResolvedValue(3);
      prismaMock.trip.groupBy
        .mockResolvedValueOnce([{ country: "France" }, { country: "Spain" }])
        .mockResolvedValueOnce([
          { destination: "Paris" },
          { destination: "Madrid" },
          { destination: "Barcelona" },
        ]);

      const result = await getUserStatistics();

      expect(result).toEqual({
        success: true,
        tripsCount: 3,
        countries: 2,
        cities: 3,
      });
      expect(prismaMock.trip.count).toHaveBeenCalledWith({
        where: { userId: "user_1", aiGenerated: true },
      });
    });

    it("ignores a null country when counting countries", async () => {
      prismaMock.trip.count.mockResolvedValue(2);
      prismaMock.trip.groupBy
        .mockResolvedValueOnce([{ country: "France" }, { country: null }])
        .mockResolvedValueOnce([{ destination: "Paris" }]);

      const result = await getUserStatistics();

      expect(result.success && result.countries).toBe(1);
    });
  });
});
