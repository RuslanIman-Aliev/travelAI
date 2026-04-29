import { auth } from "@/auth";
import { inngest } from "@/lib/inggest/client";
import { checkRateLimit, isSameOriginRequest } from "@/lib/security";
import { startTripRequestSchema } from "@/lib/validators";
import { prisma } from "@/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json(
      { success: false, message: "Invalid request origin" },
      { status: 403 },
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const rateLimit = checkRateLimit(`start-trip:${session.user.id}`, {
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

  const body = await req.json().catch(() => null);
  const payload = startTripRequestSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json(
      { success: false, message: "Invalid trip request" },
      { status: 400 },
    );
  }

  const { tripId } = payload.data;

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      userId: session.user.id,
    },
    select: {
      id: true,
      aiGenerated: true,
      status: true,
    },
  });

  if (!trip) {
    return NextResponse.json(
      { success: false, message: "Trip not found" },
      { status: 404 },
    );
  }

  if (trip.aiGenerated || trip.status === "generated") {
    return NextResponse.json(
      { success: false, message: "Trip is already generated" },
      { status: 409 },
    );
  }

  // Send the event to Inngest (Instant response)
  await inngest.send({
    name: "trip.generate",
    data: { tripId },
  });

  return NextResponse.json({
    success: true,
    message: "Background job started",
  });
}
