import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * The dashboard used to hard-code `isGenerated={true}`, so `draft`, `generating`
 * and `failed` trips existed in the database and appeared nowhere in the UI -
 * with no direct URL, they were unreachable. These tabs feed the `status`
 * parameter `getUserTrips` already accepted and validated.
 */
export const TRIP_TABS = [
  { label: "All", status: "" },
  { label: "Ready", status: "generated" },
  { label: "In progress", status: "generating" },
  { label: "Failed", status: "failed" },
] as const;

/** The statuses a caller may put in the URL; anything else falls back to All. */
export const isTripTabStatus = (value: string) =>
  TRIP_TABS.some((tab) => tab.status === value);

const TripStatusTabs = ({ active }: { active: string }) => (
  <nav aria-label="Filter trips" className="flex flex-wrap gap-2">
    {TRIP_TABS.map((tab) => {
      const isActive = tab.status === active;

      return (
        <Button
          key={tab.label}
          asChild
          size="sm"
          variant={isActive ? "default" : "outline"}
          className="h-11 lg:h-9"
        >
          <Link
            href={tab.status ? `/?status=${tab.status}` : "/"}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </Link>
        </Button>
      );
    })}
  </nav>
);

export default TripStatusTabs;
