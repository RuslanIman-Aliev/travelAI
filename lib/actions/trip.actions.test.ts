import { requireUserId } from "@/auth";
import { UserFacingError } from "@/lib/errors";
import {
  deleteTrip,
  getTripById,
  getUserStatistics,
  getUserTrips,
  insertTrip,
  renameTrip,
  reorderDayActivities,
  retryGeneration,
} from "@/lib/actions/trip.actions";
import { resetRateLimits } from "@/lib/security";
import { startTripGeneration } from "@/lib/trip-generation";
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
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    day: { deleteMany: jest.fn(), findFirst: jest.fn() },
    activity: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));

// Claiming and enqueueing has its own unit; here it only needs to be observable.
jest.mock("@/lib/trip-generation", () => ({
  startTripGeneration: jest.fn(),
}));

const requireUserIdMock = requireUserId as jest.MockedFunction<
  typeof requireUserId
>;

const startTripGenerationMock = startTripGeneration as jest.MockedFunction<
  typeof startTripGeneration
>;

const prismaMock = prisma as unknown as {
  trip: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
    updateMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  day: { deleteMany: jest.Mock; findFirst: jest.Mock };
  activity: { update: jest.Mock };
  $transaction: jest.Mock;
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
    startTripGenerationMock.mockResolvedValue({ status: "started" });
    prismaMock.$transaction.mockResolvedValue([]);
  });

  describe("insertTrip", () => {
    it("returns unauthorized when there is no session", async () => {
      requireUserIdMock.mockRejectedValue(new UserFacingError("Unauthorized"));

      const result = await insertTrip(validTrip);

      expect(result).toEqual({ success: false, message: "Unauthorized" });
      expect(prismaMock.trip.create).not.toHaveBeenCalled();
    });

    // Generation used to start from a `useEffect` on the trip page, so a trip
    // whose page was never opened simply never generated.
    it("enqueues generation on the server as part of creation", async () => {
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });

      await insertTrip(validTrip);

      expect(startTripGenerationMock).toHaveBeenCalledWith("trip_1", "user_1");
    });

    it("still returns the trip when generation could not be enqueued", async () => {
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });
      startTripGenerationMock.mockResolvedValue({ status: "enqueue-failed" });

      const result = await insertTrip(validTrip);

      expect(result.success).toBe(true);
      expect(result.success && result.message).toContain("retry");
    });

    it("stores dates as calendar days rather than instants", async () => {
      prismaMock.trip.create.mockResolvedValue({ id: "trip_1" });

      await insertTrip({
        ...validTrip,
        startDate: new Date("2026-06-10T18:45:00Z"),
        endDate: new Date("2026-06-12T02:10:00Z"),
      });

      const data = prismaMock.trip.create.mock.calls[0][0].data;
      expect(data.startDate.toISOString()).toBe("2026-06-10T00:00:00.000Z");
      expect(data.endDate.toISOString()).toBe("2026-06-12T00:00:00.000Z");
      expect(data.daysCount).toBe(3);
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

      // `not-found`, not `error`: a retry screen would confirm the id exists to
      // someone who is not allowed to know that.
      expect(result).toEqual({
        success: false,
        reason: "not-found",
        message: "Unauthorized",
      });
      expect(prismaMock.trip.findFirst).not.toHaveBeenCalled();
    });

    it("scopes the lookup to the owner and reports a miss", async () => {
      prismaMock.trip.findFirst.mockResolvedValue(null);

      const result = await getTripById("missing_trip");

      expect(result).toEqual({
        success: false,
        reason: "not-found",
        message: "Trip not found",
      });
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
      const result = await getUserTrips("generated", 2, 6);

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
        where: { userId: "user_1", status: "generated" },
        orderBy: { createdAt: "desc" },
        skip: 6,
        take: 6,
      });
    });

    it("clamps a negative page instead of producing a negative skip", async () => {
      const result = await getUserTrips(undefined, -5, 10);

      expect(result.success && result.pagination.currentPage).toBe(1);
      expect(prismaMock.trip.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it("caps an oversized page size", async () => {
      await getUserTrips(undefined, 1, 100_000);

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
      // Every trip, not just generated ones: the dashboard shows all of them, so
      // a counter that excluded the rest disagreed with the list beneath it.
      expect(prismaMock.trip.count).toHaveBeenCalledWith({
        where: { userId: "user_1" },
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

  // `trip.actions.ts` was insert/get/list/stats. A trip you did not want stayed
  // in the list forever, and a failed one was a dead end.
  describe("deleteTrip", () => {
    const TRIP_ID = "clx0000000000000000000000";

    it("scopes the delete to the owner", async () => {
      prismaMock.trip.deleteMany.mockResolvedValue({ count: 1 });

      const result = await deleteTrip(TRIP_ID);

      expect(result).toEqual({ success: true, message: "Trip deleted" });
      expect(prismaMock.trip.deleteMany).toHaveBeenCalledWith({
        where: { id: TRIP_ID, userId: "user_1" },
      });
    });

    it("reports a miss rather than throwing for someone else's trip", async () => {
      prismaMock.trip.deleteMany.mockResolvedValue({ count: 0 });

      await expect(deleteTrip(TRIP_ID)).resolves.toEqual({
        success: false,
        message: "Trip not found",
      });
    });

    it("rejects a malformed id before touching the database", async () => {
      const result = await deleteTrip("not-a-cuid");

      expect(result.success).toBe(false);
      expect(prismaMock.trip.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe("renameTrip", () => {
    const TRIP_ID = "clx0000000000000000000000";

    it("stores a trimmed title against the owner's trip", async () => {
      prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });

      const result = await renameTrip(TRIP_ID, "  Honeymoon  ");

      expect(result).toEqual({ success: true, message: "Trip renamed" });
      expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
        where: { id: TRIP_ID, userId: "user_1" },
        data: { title: "Honeymoon" },
      });
    });

    it("rejects an empty title", async () => {
      const result = await renameTrip(TRIP_ID, "   ");

      expect(result.success).toBe(false);
      expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("retryGeneration", () => {
    const TRIP_ID = "clx0000000000000000000000";

    it("clears the old days and restarts generation", async () => {
      prismaMock.trip.findFirst.mockResolvedValue({ status: "failed" });

      const result = await retryGeneration(TRIP_ID);

      expect(result).toEqual({
        success: true,
        message: "Generation restarted",
      });
      // One transaction: days cleared and the status reset together, so a trip
      // cannot end up empty but still badged as generated.
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.day.deleteMany).toHaveBeenCalledWith({
        where: { tripId: TRIP_ID },
      });
      expect(startTripGenerationMock).toHaveBeenCalledWith(TRIP_ID, "user_1");
    });

    it("refuses to restart a run that is already in flight", async () => {
      prismaMock.trip.findFirst.mockResolvedValue({ status: "generating" });

      const result = await retryGeneration(TRIP_ID);

      expect(result.success).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(startTripGenerationMock).not.toHaveBeenCalled();
    });

    it("reports a miss for a trip the caller does not own", async () => {
      prismaMock.trip.findFirst.mockResolvedValue(null);

      await expect(retryGeneration(TRIP_ID)).resolves.toEqual({
        success: false,
        message: "Trip not found",
      });
      expect(startTripGenerationMock).not.toHaveBeenCalled();
    });

    it("surfaces a failure to enqueue instead of reporting success", async () => {
      prismaMock.trip.findFirst.mockResolvedValue({ status: "failed" });
      startTripGenerationMock.mockResolvedValue({ status: "enqueue-failed" });

      const result = await retryGeneration(TRIP_ID);

      expect(result.success).toBe(false);
    });
  });

  describe("reorderDayActivities", () => {
    const DAY_ID = "clx1111111111111111111111";
    const A = "clxaaaaaaaaaaaaaaaaaaaaaa";
    const B = "clxbbbbbbbbbbbbbbbbbbbbbb";
    const C = "clxcccccccccccccccccccccc";

    beforeEach(() => {
      prismaMock.day.findFirst.mockResolvedValue({
        tripId: "trip_1",
        activities: [{ id: A }, { id: B }, { id: C }],
      });
      prismaMock.activity.update.mockImplementation((args: unknown) => args);
    });

    it("writes a position for every activity in one transaction", async () => {
      const result = await reorderDayActivities(DAY_ID, [C, A, B]);

      expect(result).toEqual({ success: true, message: "Order saved" });
      expect(
        prismaMock.activity.update.mock.calls.map((call) => call[0]),
      ).toEqual([
        { where: { id: C }, data: { userOrder: 1 } },
        { where: { id: A }, data: { userOrder: 2 } },
        { where: { id: B }, data: { userOrder: 3 } },
      ]);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    // `Day` carries no `userId`, so ownership has to be checked through the trip.
    it("scopes the day lookup to the caller's trips", async () => {
      await reorderDayActivities(DAY_ID, [A, B, C]);

      expect(prismaMock.day.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DAY_ID, trip: { userId: "user_1" } },
        }),
      );
    });

    it("refuses a day that is not the caller's", async () => {
      prismaMock.day.findFirst.mockResolvedValue(null);

      const result = await reorderDayActivities(DAY_ID, [A, B, C]);

      expect(result).toEqual({ success: false, message: "Day not found" });
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    // A partial list would leave the rest of the day holding stale positions.
    it("refuses a list that is not the day's full set", async () => {
      const result = await reorderDayActivities(DAY_ID, [A, B]);

      expect(result.success).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("refuses an activity that belongs to another day", async () => {
      const result = await reorderDayActivities(DAY_ID, [
        A,
        B,
        "clxdddddddddddddddddddddd",
      ]);

      expect(result.success).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("refuses a list with the same activity twice", async () => {
      const result = await reorderDayActivities(DAY_ID, [A, A, B]);

      expect(result.success).toBe(false);
      expect(prismaMock.day.findFirst).not.toHaveBeenCalled();
    });
  });
});
