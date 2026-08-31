import { randomUUID } from "crypto";
import { inngest } from "./inngest/client";
import { prisma } from "@/prisma";

export type StartGenerationResult =
  | { status: "started" }
  | { status: "already-running" }
  | { status: "not-found" }
  | { status: "enqueue-failed" };

/**
 * Claims a trip for generation and enqueues the background job.
 *
 * The claim is a conditional `updateMany` rather than a read followed by a
 * write: two concurrent callers would both pass a check-then-act guard and start
 * duplicate runs. Only the caller whose update actually matched a row goes on to
 * send the event.
 *
 * Shared by the API route, trip creation and the retry action, so all three
 * enter generation through exactly one code path - previously the browser was
 * the only thing that could start a job at all.
 *
 * @param {string} tripId - The trip to generate.
 * @param {string} userId - The owner making the request; scopes the claim.
 * @returns {Promise<StartGenerationResult>} What happened to the claim.
 */
export async function startTripGeneration(
  tripId: string,
  userId: string,
): Promise<StartGenerationResult> {
  const claimed = await prisma.trip.updateMany({
    where: {
      id: tripId,
      userId,
      // `status` is the whole condition now. It used to be paired with
      // `aiGenerated: false`, a second column meaning the same thing, so the
      // claim had to keep two flags agreeing to stay correct.
      status: { in: ["draft", "failed"] },
    },
    data: { status: "generating" },
  });

  if (claimed.count === 0) {
    const exists = await prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: { id: true },
    });

    return exists ? { status: "already-running" } : { status: "not-found" };
  }

  // Inngest deduplicates on event id for 24 hours. A constant
  // `trip-generate-<tripId>` therefore made every retry within a day a silent
  // no-op - the trip flipped to `generating` and no run ever started. The nonce
  // is computed once here, so a retry of this same send is still deduplicated
  // while a genuinely new attempt is not.
  const eventId = `trip-generate-${tripId}-${randomUUID()}`;

  try {
    await inngest.send({
      id: eventId,
      name: "trip.generate",
      data: { tripId },
    });
  } catch (error) {
    // The claim above already moved the trip to `generating`. If the event never
    // lands there is no run, so no `onFailure` to settle it later - the trip
    // would sit in `generating` forever with nothing working on it. Release the
    // claim here instead, so the user can retry.
    console.error("Failed to enqueue trip generation:", error);

    await prisma.trip.updateMany({
      where: { id: tripId, userId, status: "generating" },
      data: { status: "failed" },
    });

    return { status: "enqueue-failed" };
  }

  return { status: "started" };
}
