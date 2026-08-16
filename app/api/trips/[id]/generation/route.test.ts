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
        aiGenerated: false,
        status: { in: ["draft", "failed"] },
      },
      data: { status: "generating" },
    });
    expect(sendMock).toHaveBeenCalledWith({
      id: `trip-generate-${TRIP_ID}`,
      name: "trip.generate",
      data: { tripId: TRIP_ID },
    });
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
});

describe("GET /api/trips/[id]/generation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRateLimits();
    authMock.mockResolvedValue({ user: { id: "user_1" } } as never);
  });

  it("reports the current generation state", async () => {
    prismaMock.trip.findFirst.mockResolvedValue({
      status: "generated",
      aiGenerated: true,
    });

    const res = await GET(makeRequest(ORIGIN, "GET"), context());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      success: true,
      status: "generated",
      aiGenerated: true,
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
