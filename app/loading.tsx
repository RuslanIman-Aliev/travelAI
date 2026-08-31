import { Spinner } from "@/components/ui/spinner";

/**
 * Streaming fallback for the whole app segment. The dashboard and the trip page
 * both await database work before their first byte, so without this the browser
 * sat on the previous page with no feedback at all.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Spinner className="size-8" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
