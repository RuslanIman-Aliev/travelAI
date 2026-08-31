"use client";

import { Button } from "@/components/ui/button";
import StatusScreen from "@/components/utils/status-screen";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary. Without it any unhandled exception in a server
 * component dropped the user on Next's default screen - no sidebar, no styling,
 * no way back.
 *
 * Next only hands the client a `digest` in production, so the message is never
 * shown; `reset()` re-renders the segment, which is what makes a transient
 * database blip recoverable without a full reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <StatusScreen
      icon={AlertTriangle}
      tone="danger"
      title="Something went wrong"
      description="We couldn't load this page. This is usually temporary - try again in a moment."
    >
      <Button className="h-11 lg:h-9" onClick={reset}>
        Try again
      </Button>
      <Button variant="outline" className="h-11 lg:h-9" asChild>
        <Link href="/">Back to your trips</Link>
      </Button>
      {error.digest && (
        <p className="w-full text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
    </StatusScreen>
  );
}
