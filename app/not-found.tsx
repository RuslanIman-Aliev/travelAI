import { Button } from "@/components/ui/button";
import StatusScreen from "@/components/utils/status-screen";
import { Compass } from "lucide-react";
import Link from "next/link";

/**
 * Shown for `notFound()` and for any unmatched URL. Rendered inside the root
 * layout, so the sidebar and theme stay put.
 */
export default function NotFound() {
  return (
    <StatusScreen
      icon={Compass}
      title="This page doesn't exist"
      description="The trip or page you're looking for isn't here. It may have been deleted, or the link may be wrong."
    >
      <Button className="h-11 lg:h-9" asChild>
        <Link href="/">Back to your trips</Link>
      </Button>
      <Button variant="outline" className="h-11 lg:h-9" asChild>
        <Link href="/new-trip">Plan a new trip</Link>
      </Button>
    </StatusScreen>
  );
}
