"use client";

import { Button } from "@/components/ui/button";
import { retryGeneration } from "@/lib/actions/trip.actions";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

/**
 * Restarts generation for a trip that failed. Previously a failed trip was a
 * dead end: the only control on the screen sent the user off to create a new one
 * from scratch.
 */
const RetryGenerationButton = ({ tripId }: { tripId: string }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onRetry = () => {
    startTransition(async () => {
      const res = await retryGeneration(tripId);

      if (!res.success) {
        toast.error(res.message);
        return;
      }

      toast.success("Generation restarted");
      router.refresh();
    });
  };

  return (
    <Button className="h-11 lg:h-9" onClick={onRetry} disabled={isPending}>
      {isPending ? "Starting..." : "Try again"}
    </Button>
  );
};

export default RetryGenerationButton;
