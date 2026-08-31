import { auth } from "@/auth";
import { checkRateLimit, isSameOriginRequest } from "@/lib/security";
import { startTripGeneration } from "@/lib/trip-generation";
import { tripIdSchema } from "@/lib/validators";
import { prisma } from "@/prisma";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

type ResolvedRequest =
  | { ok: true; tripId: string; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Runs the checks both handlers share: same-origin, authenticated, and a
 * well-formed trip id.
 *
 * @param {Request} request - The incoming request.
 * @param {RouteContext} context - The route context carrying the trip id.
 * @returns {Promise<ResolvedRequest>} The resolved ids, or the response to return instead.
 */
async function resolveRequest(
  request: Request,
  context: RouteContext,
): Promise<ResolvedRequest> {
  const reject = (message: string, status: number): ResolvedRequest => ({
    ok: false,
    response: NextResponse.json({ success: false, message }, { status }),
  });

  if (!isSameOriginRequest(request)) {
    return reject("Invalid request origin", 403);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return reject("Unauthorized", 401);
  }

  const { id } = await context.params;
  const parsedId = tripIdSchema.safeParse(id);
  if (!parsedId.success) {
    return reject("Invalid trip id", 400);
  }

  return { ok: true, tripId: parsedId.data, userId: session.user.id };
}

/**
 * Reports the generation state of a trip. Used by the trip page to poll without
 * re-rendering the whole route on every tick.
 *
 * @param {Request} request - The incoming request.
 * @param {RouteContext} context - The route context carrying the trip id.
 * @returns {Promise<NextResponse>} `{ status }` for the trip.
 */
export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const resolved = await resolveRequest(request, context);
  if (!resolved.ok) return resolved.response;

  const trip = await prisma.trip.findFirst({
    where: { id: resolved.tripId, userId: resolved.userId },
    select: { status: true },
  });

  if (!trip) {
    return NextResponse.json(
      { success: false, message: "Trip not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true, ...trip });
}

/**
 * Starts itinerary generation for a trip.
 *
 * The claim, the enqueue and the rollback all live in `startTripGeneration`, so
 * this route, trip creation and the retry action cannot drift apart.
 *
 * @param {Request} request - The incoming request.
 * @param {RouteContext} context - The route context carrying the trip id.
 * @returns {Promise<NextResponse>} The JSON response indicating success or the failure reason.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const resolved = await resolveRequest(request, context);
  if (!resolved.ok) return resolved.response;

  const { tripId, userId } = resolved;

  const rateLimit = checkRateLimit(`start-trip:${userId}`, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many trip generation requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil(rateLimit.retryAfterMs / 1000)),
          ),
        },
      },
    );
  }

  const result = await startTripGeneration(tripId, userId);

  if (result.status === "not-found") {
    return NextResponse.json(
      { success: false, message: "Trip not found" },
      { status: 404 },
    );
  }

  if (result.status === "already-running") {
    return NextResponse.json(
      { success: false, message: "Trip generation already in progress" },
      { status: 409 },
    );
  }

  if (result.status === "enqueue-failed") {
    return NextResponse.json(
      {
        success: false,
        message: "Could not start trip generation. Please try again.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { success: true, message: "Background job started" },
    { status: 202 },
  );
}
