"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { AlertCircle } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";

const POLL_INTERVAL_MS = 3000;
/** Give up after ~5 minutes rather than polling a stuck trip forever. */
const MAX_POLL_ATTEMPTS = 100;

const LoadingSpinner = ({ tripId }: { tripId: string }) => {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [shouldPoll, setShouldPoll] = useState(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const startTripGeneration = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/generation`, {
          method: "POST",
        });

        // 409 means another request already claimed this trip - that is a
        // success from this component's point of view, so poll either way.
        if (res.ok || res.status === 409) {
          if (res.ok) toast.success("Trip generation started!");
          setShouldPoll(true);
          return;
        }

        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Failed to generate trip");
        toast.error("Failed to start trip generation.");
      } catch {
        setError("Network connection error. Please try again.");
      }
    };

    startTripGeneration();
  }, [tripId]);

  useEffect(() => {
    if (!shouldPoll) return;

    let attempts = 0;
    let cancelled = false;

    // Poll a small JSON endpoint and only refresh the route once the job has
    // actually finished. The previous version called `router.refresh()` on a
    // bare interval that had no terminal condition, so a failed trip re-rendered
    // the entire page every three seconds indefinitely.
    const interval = setInterval(async () => {
      attempts += 1;

      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        if (!cancelled) {
          setError("Generation is taking longer than expected.");
        }
        return;
      }

      try {
        const res = await fetch(`/api/trips/${tripId}/generation`);
        if (!res.ok) return;

        const data = await res.json();
        if (data.status === "generated" || data.status === "failed") {
          clearInterval(interval);
          if (!cancelled) router.refresh();
        }
      } catch {
        // Transient network errors are expected while a deploy restarts; the
        // attempt cap is what bounds this loop.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldPoll, router, tripId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h3 className="text-lg font-semibold text-red-600">
          Oops! Something went wrong
        </h3>
        <p className="text-slate-500 max-w-xs">{error}</p>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={() => router.push("/new-trip")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <Image
        src="/image-for-loading-page.png"
        fill
        alt=""
        className="object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 flex flex-col justify-center items-center z-10 dark:bg-[linear-gradient(to_right,#09090bE6,#232328E6)]">
        <Empty className="w-full">
          <EmptyHeader>
            <EmptyMedia>
              <Spinner className="size-10" />
            </EmptyMedia>
            <EmptyTitle className="text-3xl">
              Processing your request
            </EmptyTitle>
            <EmptyDescription className="text-md pt-3">
              Please wait while we process your request. Do not refresh the
              page. This may take from 45 seconds to 1.5 minute.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    </div>
  );
};

export default LoadingSpinner;
