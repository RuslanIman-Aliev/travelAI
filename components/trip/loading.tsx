"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import StatusScreen from "@/components/utils/status-screen";
import { retryGeneration } from "@/lib/actions/trip.actions";
import { apiUrl } from "@/lib/api-client";
import type { TripStatus } from "@prisma/client";
import { AlertCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";

/**
 * Polling schedule. A generation takes tens of seconds, so the first few checks
 * are close together and then back off - a flat three-second tick meant twenty
 * simultaneous generations put four hundred queries a minute on the database for
 * no better answer.
 *
 * Growth is geometric and capped, and the whole schedule is bounded by
 * `MAX_POLL_MS` rather than by a count, so changing the pacing cannot silently
 * change how long the page waits.
 */
const FIRST_POLL_MS = 2_000;
const POLL_BACKOFF_FACTOR = 1.4;
const MAX_POLL_INTERVAL_MS = 15_000;
/** Give up after ~5 minutes rather than watching a stuck trip forever. */
const MAX_POLL_MS = 5 * 60_000;

const nextPollDelay = (current: number) =>
  Math.min(Math.round(current * POLL_BACKOFF_FACTOR), MAX_POLL_INTERVAL_MS);

/**
 * The waiting room for a trip that is not ready yet.
 *
 * It used to *start* the job from a mount effect, which meant a trip only ever
 * generated if a browser happened to open its page. Creation now enqueues the
 * job on the server, so this component only watches - and for a trip that was
 * never enqueued it offers a button, which is a user action rather than a side
 * effect of rendering.
 */
const LoadingSpinner = ({
  tripId,
  status,
}: {
  tripId: string;
  status: TripStatus;
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();

  const isRunning = status === "generating";

  useEffect(() => {
    if (!isRunning) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let delay = FIRST_POLL_MS;
    const deadline = Date.now() + MAX_POLL_MS;

    // Poll a small JSON endpoint and only refresh the route once the job has
    // actually finished. The previous version called `router.refresh()` on a
    // bare interval that had no terminal condition, so a failed trip re-rendered
    // the entire page every three seconds indefinitely.
    //
    // A chained timeout rather than an interval: each delay depends on the last,
    // and a slow response cannot stack a second request on top of the first.
    const poll = async () => {
      if (cancelled) return;

      if (Date.now() >= deadline) {
        setError(
          "We stopped watching after five minutes. The itinerary may still arrive - check back in a moment.",
        );
        return;
      }

      try {
        const res = await fetch(apiUrl(`/trips/${tripId}/generation`), {
          // The API is a different origin, so the session cookie only travels
          // when the request asks for it.
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "generated" || data.status === "failed") {
            if (!cancelled) router.refresh();
            return;
          }
        }
      } catch {
        // Transient network errors are expected while a deploy restarts; the
        // deadline is what bounds this loop.
      }

      if (cancelled) return;

      delay = nextPollDelay(delay);
      timer = setTimeout(poll, delay);
    };

    timer = setTimeout(poll, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRunning, router, tripId]);

  const onStart = () => {
    startTransition(async () => {
      const res = await retryGeneration(tripId);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success("Trip generation started!");
      router.refresh();
    });
  };

  // Hitting the attempt cap does not mean the run died - the job may still be
  // working through its retries, and `onFailure` is what will eventually settle
  // it. Offering "restart" here would just be refused, so the honest action is
  // to look again.
  if (error) {
    return (
      <StatusScreen
        icon={AlertCircle}
        title="This is taking longer than expected"
        description={error}
      >
        <Button className="h-11 lg:h-9" onClick={() => router.refresh()}>
          Check again
        </Button>
        <Button
          variant="outline"
          className="h-11 lg:h-9"
          onClick={() => router.push("/")}
        >
          Back to your trips
        </Button>
      </StatusScreen>
    );
  }

  // `draft` means nothing is scheduled - creation could not enqueue the job, or
  // the trip predates server-side enqueueing. Offer the start rather than firing
  // it from an effect.
  if (!isRunning) {
    return (
      <StatusScreen
        icon={Sparkles}
        title="This trip hasn't been generated yet"
        description="We haven't built an itinerary for this trip. Start it whenever you're ready - it usually takes under two minutes."
      >
        <Button className="h-11 lg:h-9" onClick={onStart} disabled={isStarting}>
          {isStarting ? "Starting..." : "Generate itinerary"}
        </Button>
        <Button
          variant="outline"
          className="h-11 lg:h-9"
          onClick={() => router.push("/")}
        >
          Back to your trips
        </Button>
      </StatusScreen>
    );
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden">
      <Image
        src="/image-for-loading-page.png"
        fill
        alt=""
        className="object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 flex flex-col justify-center items-center z-10 bg-background/80 dark:bg-[linear-gradient(to_right,#09090bE6,#232328E6)]">
        <Empty className="w-full">
          <EmptyHeader>
            <EmptyMedia>
              <Spinner className="size-10" />
            </EmptyMedia>
            <EmptyTitle className="text-2xl sm:text-3xl">
              Processing your request
            </EmptyTitle>
            <EmptyDescription className="text-md pt-3">
              Please wait while we build your itinerary. This may take from 45
              seconds to 1.5 minutes.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
};

export default LoadingSpinner;
