import { inngest } from "@/lib/inngest/client";
import { startTripGeneration } from "@/lib/trip-generation";
import { prisma } from "@/prisma";

jest.mock("@/lib/inngest/client", () => ({ inngest: { send: jest.fn() } }));

jest.mock("@/prisma", () => ({
  prisma: {
    trip: { updateMany: jest.fn(), findFirst: jest.fn() },
  },
}));

const sendMock = inngest.send as jest.Mock;
const prismaMock = prisma as unknown as {
  trip: { updateMany: jest.Mock; findFirst: jest.Mock };
};

const TRIP_ID = "clx0000000000000000000000";

describe("startTripGeneration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendMock.mockReset();
    prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  });

  it("claims only a trip the caller owns that is not already running", async () => {
    await startTripGeneration(TRIP_ID, "user_1");

    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: {
        id: TRIP_ID,
        userId: "user_1",
        status: { in: ["draft", "failed"] },
      },
      data: { status: "generating" },
    });
  });

  it("reports a started run once the event is sent", async () => {
    await expect(startTripGeneration(TRIP_ID, "user_1")).resolves.toEqual({
      status: "started",
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  // A constant event id is deduplicated by Inngest for 24 hours, which made
  // every retry inside that window flip the status and start nothing.
  it("gives each attempt a distinct event id", async () => {
    await startTripGeneration(TRIP_ID, "user_1");
    await startTripGeneration(TRIP_ID, "user_1");

    const [first, second] = sendMock.mock.calls.map((call) => call[0].id);
    expect(first).toContain(`trip-generate-${TRIP_ID}-`);
    expect(first).not.toBe(second);
  });

  it("does not enqueue when the claim loses the race", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.trip.findFirst.mockResolvedValue({ id: TRIP_ID });

    await expect(startTripGeneration(TRIP_ID, "user_1")).resolves.toEqual({
      status: "already-running",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("reports a miss for a trip that is not the caller's", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.trip.findFirst.mockResolvedValue(null);

    await expect(startTripGeneration(TRIP_ID, "user_1")).resolves.toEqual({
      status: "not-found",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  // Nothing settles a claim that no run exists for, so it has to be released here.
  it("releases the claim when the event cannot be enqueued", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockRejectedValue(new Error("inngest unreachable"));

    await expect(startTripGeneration(TRIP_ID, "user_1")).resolves.toEqual({
      status: "enqueue-failed",
    });
    expect(prismaMock.trip.updateMany).toHaveBeenLastCalledWith({
      where: { id: TRIP_ID, userId: "user_1", status: "generating" },
      data: { status: "failed" },
    });
  });
});
