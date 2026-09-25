import { prisma } from "@/prisma";
import { FinishReason, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { NonRetriableError } from "inngest";
import type { ZodError } from "zod";
import { parseCostString } from "../cost";
import { toGeminiResponseSchema } from "../gemini-schema";
import type { AIActivity, AIDay } from "../types";
import { getAIPrompt, getPhotoByDestination } from "../utils";
import {
  MAX_ACTIVITIES_PER_DAY,
  aiGenerationResponseSchema,
} from "../validators";
import { inngest } from "./client";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";

/**
 * Gemini 3 models reason before answering, and that reasoning dominates latency
 * for a task that is mostly structured recall. `LOW` is the default rather than
 * `MINIMAL` because the prompt still asks for real coordinates and for activity
 * costs that sum under a budget - the two things most likely to degrade without
 * any reasoning. Tunable so the quality/latency trade can be measured, not guessed.
 */
const THINKING_LEVELS: Record<string, ThinkingLevel> = {
  MINIMAL: ThinkingLevel.MINIMAL,
  LOW: ThinkingLevel.LOW,
  MEDIUM: ThinkingLevel.MEDIUM,
  HIGH: ThinkingLevel.HIGH,
};

const resolveThinkingLevel = (): ThinkingLevel => {
  const configured = process.env.GEMINI_THINKING_LEVEL?.toUpperCase();
  if (!configured) return ThinkingLevel.LOW;

  const level = THINKING_LEVELS[configured];
  if (!level) {
    console.warn(
      `Unknown GEMINI_THINKING_LEVEL "${configured}", falling back to LOW`,
    );
    return ThinkingLevel.LOW;
  }

  return level;
};

const THINKING_LEVEL = resolveThinkingLevel();

/**
 * Built once: converting the Zod schema walks the whole tree, and it never
 * changes between requests.
 */
const RESPONSE_JSON_SCHEMA = toGeminiResponseSchema(aiGenerationResponseSchema);

/** How much of a rejected response to log before it stops being useful. */
const REJECTED_RESPONSE_LOG_LENGTH = 2_000;

/** How many Zod issues to name in the thrown message. */
const REPORTED_ISSUE_LIMIT = 5;

/**
 * Token cost of the pieces of a response, used to size the output ceiling from
 * what the schema actually permits rather than from a round number.
 *
 * `TOKENS_PER_ACTIVITY` is deliberately about double a typical activity object:
 * the prompt caps `description` at ten words and `title` at a place name, so a
 * real one lands nearer 60 tokens. The headroom is the point - undershooting
 * truncates JSON mid-object, which costs a whole regeneration.
 */
const TOKENS_PER_ACTIVITY = 120;
const TOKENS_PER_DAY_ENVELOPE = 64;
const RESPONSE_ENVELOPE_TOKENS = 256;

/**
 * The most the model will emit in one response. Configurable because it is a
 * property of the model, not of this code, and it changes when `GEMINI_MODEL`
 * does.
 */
const MODEL_MAX_OUTPUT_TOKENS =
  Number(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 65_536;

/**
 * Ceiling on generated tokens, scaled by trip length.
 *
 * The old ceiling was `min(32_768, ...)`, a number unrelated to anything the
 * schema allows: 30 days times `MAX_ACTIVITIES_PER_DAY` cannot fit in it, so a
 * long trip was truncated by our own cap, surfaced as "AI returned no content",
 * and burned every retry before landing in `failed`. Deriving it from the same
 * bounds the response is validated against keeps the two from disagreeing.
 *
 * @param {number} daysCount - Number of days in the trip.
 * @returns {number} A token ceiling for this request.
 */
const maxOutputTokensFor = (daysCount: number) => {
  const days = Math.max(daysCount, 1);
  const needed =
    RESPONSE_ENVELOPE_TOKENS +
    days *
      (TOKENS_PER_DAY_ENVELOPE + MAX_ACTIVITIES_PER_DAY * TOKENS_PER_ACTIVITY);

  return Math.min(MODEL_MAX_OUTPUT_TOKENS, needed);
};

/**
 * Converts various optional types to a strict number or null.
 * Helps prevent NaN bugs by coalescing empty/invalid strings to a predictable null.
 *
 * @param {string|number|null} [value] - The value to cast.
 * @returns {number|null} Converted continuous number, or null if incompatible.
 */
const toNumberOrNull = (value?: string | number | null) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Validates whether a provided set of coordinates falls within real-world geographic bounds.
 *
 * @param {number} lat - Latitude bounded from -90 to 90.
 * @param {number} lng - Longitude bounded from -180 to 180.
 * @returns {boolean} Indicates if the coordinate pair is structurally valid.
 */
const isValidCoordinate = (lat: number, lng: number) =>
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;

/**
 * Resolves an activity's coordinates, returning nulls unless the pair is complete
 * and geographically valid. Computed once per activity rather than per column.
 *
 * @param {AIActivity} activity - An activity from the model response.
 * @returns {{latitude: number|null, longitude: number|null}} The validated pair.
 */
const toCoordinates = (activity: AIActivity) => {
  const latitude = toNumberOrNull(activity.latitude);
  const longitude = toNumberOrNull(activity.longitude);

  if (
    latitude == null ||
    longitude == null ||
    !isValidCoordinate(latitude, longitude)
  ) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
};

/**
 * Maps one model activity onto the columns persisted for it, parsing its
 * free-text cost into minor units here - the single ingestion point - so no
 * regex has to run at render time.
 *
 * @param {AIActivity} activity - An activity from the model response.
 * @param {number} index - Zero-based position within its day.
 * @returns {object} A Prisma `Activity` create payload.
 */
const toActivityCreateInput = (activity: AIActivity, index: number) => {
  const cost = parseCostString(
    activity.estimatedCost ?? activity.ticket_pricing,
  );
  const { latitude, longitude } = toCoordinates(activity);

  return {
    order: index + 1,
    time: activity.time,
    title: activity.title?.trim() || activity.placeName?.trim() || "Activity",
    // The prompt no longer asks for `placeName` - it used to instruct the model to
    // repeat the place name into both fields, which was pure duplicated output.
    // The fallback stays so a response from the older prompt still maps cleanly.
    placeName: activity.placeName?.trim() || activity.title?.trim(),
    description: activity.description,
    placeType: activity.placeType,
    estimatedCostCents: cost.cents,
    estimatedCostCurrency: cost.currency,
    estimatedCostIsFree: cost.isFree,
    latitude,
    longitude,
  };
};

type ValidationIssue = ZodError["issues"][number];

/** How deep into the response an issue points, used to rank union branches. */
const deepestPath = (issues: readonly ValidationIssue[]) =>
  issues.reduce((deepest, issue) => Math.max(deepest, issue.path.length), 0);

/**
 * Flattens a union failure down to the branch the model was actually attempting.
 *
 * A failed `aiGenerationResponseSchema` parse always reports `invalid_union` at
 * the root, and the only useful detail sits in the per-branch issues nested
 * inside it. Reporting every branch would pair the real problem with a useless
 * "error: expected string, received undefined" from the escape hatch, so the
 * branch whose issues reach furthest into the response wins - a malformed
 * itinerary points at `itinerary[0].activities[2].placeType`, while the error
 * variant can only ever point at `error`.
 *
 * @param {readonly ValidationIssue[]} issues - Issues from one parse attempt.
 * @returns {ValidationIssue[]} The issues worth reporting.
 */
const significantIssues = (
  issues: readonly ValidationIssue[],
): ValidationIssue[] =>
  issues.flatMap((issue) => {
    if (issue.code !== "invalid_union" || issue.errors.length === 0) {
      return issue;
    }

    const branches = issue.errors.map((branch) => significantIssues(branch));
    return branches.reduce((deepest, branch) =>
      deepestPath(branch) > deepestPath(deepest) ? branch : deepest,
    );
  });

/**
 * Renders the path of an issue the way the response itself is indexed, so the
 * offending value can be found in the logged payload by reading it.
 *
 * @param {readonly PropertyKey[]} path - The issue's path.
 * @returns {string} A dotted path with array indices in brackets.
 */
const formatIssuePath = (path: readonly PropertyKey[]) =>
  path.reduce<string>((rendered, segment) => {
    if (typeof segment === "number") return `${rendered}[${segment}]`;
    return rendered ? `${rendered}.${String(segment)}` : String(segment);
  }, "") || "(root)";

/**
 * Summarises a validation failure for the message Inngest shows on the run.
 *
 * @param {ZodError} error - The failed parse.
 * @returns {string} A short, single-line description of what did not match.
 */
const describeIssues = (error: ZodError) => {
  const issues = significantIssues(error.issues);
  const reported = issues
    .slice(0, REPORTED_ISSUE_LIMIT)
    .map((issue) => `${formatIssuePath(issue.path)}: ${issue.message}`)
    .join("; ");
  const remaining = issues.length - REPORTED_ISSUE_LIMIT;

  return remaining > 0 ? `${reported} (+${remaining} more)` : reported;
};

/**
 * The terminal state for a run that exhausted its retries.
 *
 * Only one failure path used to write `failed` - the model reporting an unknown
 * destination. Every other failure (Gemini timeout, `MAX_TOKENS`, malformed JSON,
 * schema mismatch) just threw, so the trip stayed `generating` forever: endless
 * spinner, and a POST that answers 409 "already in progress" on every retry.
 *
 * `updateMany` rather than `update` because this also runs for a trip that was
 * never found, where `update` would throw inside the failure handler itself. The
 * `generating` guard keeps it from touching a trip that some other run already
 * settled.
 *
 * @param {string} tripId - The trip whose run has failed for good.
 * @returns {Promise<void>} Resolves once the status is settled.
 */
const markTripFailed = async (tripId: string) => {
  await prisma.trip.updateMany({
    where: { id: tripId, status: "generating" },
    data: { status: "failed" },
  });
};

/**
 * Defines the main Inngest serverless function to invoke Google Gemini,
 * retrieve an itinerary, validate data, and synchronize it back with the database.
 * Triggers async whenever 'trip.generate' event signals.
 *
 * @type {import('inngest').InngestFunction}
 */
export const generateTripFunction = inngest.createFunction(
  {
    id: "generate-trip-itinerary",
    triggers: [{ event: "trip.generate" }],
    // Runs once every retry is spent, which is the only place that can honestly
    // call a generation dead.
    onFailure: async ({ event, error }) => {
      const tripId = event.data.event?.data?.tripId;
      if (typeof tripId !== "string" || !tripId) return;

      console.error("[inngest] trip generation failed", {
        tripId,
        runId: event.data.run_id,
        error: error.message,
      });

      await markTripFailed(tripId);
    },
  },
  async ({ event, step }) => {
    const { tripId } = event.data;

    const trip = await step.run("fetch-trip", async () =>
      prisma.trip.findUnique({ where: { id: tripId } }),
    );

    if (!trip) {
      throw new NonRetriableError(`Trip not found: ${tripId}`);
    }

    const aiResult = await step.run("generate-itinerary", async () => {
      const tripWithDates = {
        ...trip,
        startDate: new Date(trip.startDate),
        endDate: new Date(trip.endDate),
        createdAt: new Date(trip.createdAt),
        updatedAt: new Date(trip.updatedAt),
      };
      const prompt = getAIPrompt({ trip: tripWithDates });
      const maxOutputTokens = maxOutputTokensFor(trip.daysCount);

      const startedAt = Date.now();
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          // Constrained decoding: the model can only emit a shape that parses,
          // which removes the schema-mismatch retry - a full second generation.
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL },
          maxOutputTokens,
        },
      });
      const durationMs = Date.now() - startedAt;

      const usage = response.usageMetadata;
      // `thoughtsTokenCount` vs `candidatesTokenCount` is what attributes the wait
      // to reasoning or to output, and therefore what justifies any further work.
      console.info("[gemini] itinerary generated", {
        tripId,
        model: MODEL,
        thinkingLevel: THINKING_LEVEL,
        daysCount: trip.daysCount,
        durationMs,
        promptTokens: usage?.promptTokenCount,
        thoughtsTokens: usage?.thoughtsTokenCount,
        outputTokens: usage?.candidatesTokenCount,
        totalTokens: usage?.totalTokenCount,
      });

      const finishReason = response.candidates?.[0]?.finishReason;

      // Hitting the ceiling is not a transient failure: the same prompt produces
      // the same length every time, so the three remaining retries would each
      // spend a full generation to arrive back here. Fail immediately and let
      // `onFailure` settle the trip, with a message that names the actual limit.
      if (finishReason === FinishReason.MAX_TOKENS) {
        throw new NonRetriableError(
          `Itinerary exceeded the ${maxOutputTokens} output-token ceiling for a ${trip.daysCount}-day trip`,
        );
      }

      // The response text is the AI's generated content.
      const text = response.text;
      if (!text) {
        throw new Error(
          `AI returned no content (finishReason: ${finishReason ?? "unknown"})`,
        );
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("AI response was not valid JSON");
      }

      const parsed = aiGenerationResponseSchema.safeParse(json);
      if (!parsed.success) {
        // The bare message this used to throw named neither the field nor the
        // value, which made a mismatch impossible to act on: the response is
        // gone by the time anyone reads the run. Log the payload that failed,
        // and put the failing paths in the message Inngest surfaces.
        console.error("[gemini] itinerary failed validation", {
          tripId,
          issues: parsed.error.issues,
          response: text.slice(0, REJECTED_RESPONSE_LOG_LENGTH),
        });

        throw new Error(
          `AI response did not match itinerary schema: ${describeIssues(parsed.error)}`,
        );
      }

      return parsed.data;
    });

    if ("error" in aiResult) {
      await step.run("handle-invalid-location", async () => {
        await prisma.trip.update({
          where: { id: tripId },
          data: { status: "failed" },
        });
      });

      throw new NonRetriableError(`Invalid Location: ${aiResult.error}`);
    }

    // Fetched before the write so a Pexels outage cannot roll back, or partially
    // apply, the itinerary itself.
    const destinationImage = await step.run(
      "fetch-destination-photo",
      async () => getPhotoByDestination(trip.destination),
    );

    await step.run("save-itinerary", async () => {
      // A single transaction so a retry of this step can never leave a trip with
      // days but no `generated` status. `Day` also carries a unique constraint on
      // (tripId, dayNumber), so a duplicate run fails loudly instead of doubling
      // every day in the itinerary.
      await prisma.$transaction([
        ...aiResult.itinerary.map((day: AIDay) =>
          prisma.day.create({
            data: {
              tripId,
              dayNumber: day.dayNumber,
              date: new Date(day.date),
              summary: day.summary,
              activities: {
                create: day.activities.map(toActivityCreateInput),
              },
            },
          }),
        ),
        prisma.trip.update({
          where: { id: tripId },
          data: {
            status: "generated",
            imageUrl: destinationImage,
          },
        }),
      ]);
    });

    return { success: true, tripId };
  },
);
