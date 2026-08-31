import { auth } from "@/auth";
import { inngest } from "@/lib/inngest/client";
import { resetRateLimits } from "@/lib/security";
import { prisma } from "@/prisma";
import { GET, POST } from "./route";

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("@/lib/inngest/client", () => ({ inngest: { send: jest.fn() } }));
jest.mock("@/prisma", () => ({
  prisma: {
    trip: {
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

const authMock = auth as jest.MockedFunction<typeof auth>;
const sendMock = inngest.send as jest.Mock;
const prismaMock = prisma as unknown as {
  trip: { updateMany: jest.Mock; findFirst: jest.Mock };
};

const TRIP_ID = "clx0000000000000000000000";
const ORIGIN = "https://travel.example.com";

const makeRequest = (origin: string | null = ORIGIN, method = "POST") =>
  new Request(`${ORIGIN}/api/trips/${TRIP_ID}/generation`, {
    method,
    headers: origin ? { origin } : undefined,
  });

const context = (id: string = TRIP_ID) => ({ params: Promise.resolve({ id }) });

describe("POST /api/trips/[id]/generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
    prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  });

  it("rejects a cross-origin request", async () => {
    const res = await POST(makeRequest("https://evil.example.com"), context());

    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    authMock.mockResolvedValue(null);

    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(401);
    expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed trip id", async () => {
    const res = await POST(makeRequest(), context("not-a-cuid"));

    expect(res.status).toBe(400);
    expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
  });

  it("claims the trip and enqueues a deduplicated event", async () => {
    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(202);
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: {
        id: TRIP_ID,
        userId: "user_1",
        status: { in: ["draft", "failed"] },
      },
      data: { status: "generating" },
    });
    // The id carries a per-attempt nonce. A constant id would be deduplicated by
    // Inngest for 24 hours, which silently turned every retry into a no-op.
    expect(sendMock).toHaveBeenCalledWith({
      id: expect.stringMatching(new RegExp(`^trip-generate-${TRIP_ID}-.+`)),
      name: "trip.generate",
      data: { tripId: TRIP_ID },
    });
  });

  it("gives each attempt its own event id so retries are not deduplicated", async () => {
    await POST(makeRequest(), context());
    await POST(makeRequest(), context());

    const [first, second] = sendMock.mock.calls.map((call) => call[0].id);
    expect(first).not.toBe(second);
  });

  it("returns 409 without enqueuing when the claim loses the race", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.trip.findFirst.mockResolvedValue({ id: TRIP_ID });

    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(409);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the trip does not belong to the caller", async () => {
    prismaMock.trip.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.trip.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated starts by the same user", async () => {
    for (let i = 0; i < 10; i += 1) {
      await POST(makeRequest(), context());
    }

    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(sendMock).toHaveBeenCalledTimes(10);
  });

  // The claim has already flipped the trip to `generating` by this point. A send
  // that never lands means no run exists, so nothing will ever settle the status
  // - the trip would spin forever behind a 409.
  it("releases the claim when the event cannot be enqueued", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    // `clearAllMocks` wipes calls but keeps implementations, so a rejection set
    // here would leak into the next test - reset before installing one.
    sendMock.mockReset();
    sendMock.mockRejectedValue(new Error("inngest unreachable"));

    const res = await POST(makeRequest(), context());

    expect(res.status).toBe(502);
    expect(prismaMock.trip.updateMany).toHaveBeenLastCalledWith({
      where: { id: TRIP_ID, userId: "user_1", status: "generating" },
      data: { status: "failed" },
    });
  });

  it("leaves a released trip startable again", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    sendMock.mockReset();
    sendMock.mockRejectedValueOnce(new Error("inngest unreachable"));

    await POST(makeRequest(), context());

    // `failed` is one of the statuses the claim accepts, so the retry goes
    // through instead of bouncing off a 409 forever.
    const claimedStatuses =
      prismaMock.trip.updateMany.mock.calls[0][0].where.status.in;
    expect(claimedStatuses).toContain("failed");

    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(202);
  });
});

describe("GET /api/trips/[id]/generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
  });

  it("reports the current generation state", async () => {
    prismaMock.trip.findFirst.mockResolvedValue({ status: "generated" });

    const res = await GET(makeRequest(ORIGIN, "GET"), context());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      status: "generated",
    });
  });

  it("does not expose another user's trip", async () => {
    prismaMock.trip.findFirst.mockResolvedValue(null);

    const res = await GET(makeRequest(ORIGIN, "GET"), context());

    expect(res.status).toBe(404);
    expect(prismaMock.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TRIP_ID, userId: "user_1" },
      }),
    );
  });
});
