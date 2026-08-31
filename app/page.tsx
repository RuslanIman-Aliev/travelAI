import { auth } from "@/auth";
import { StatsCard } from "@/components/home/statsCard";
import TripStatusTabs, {
  isTripTabStatus,
} from "@/components/home/trip-status-tabs";
import UserTrips from "@/components/home/user-trips";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { getUserStatistics } from "@/lib/actions/trip.actions";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home(props: Props) {
  const searchParams = await props.searchParams;
  const page = Number(searchParams?.page) || 1;
  const requestedStatus =
    typeof searchParams?.status === "string" ? searchParams.status : "";
  const status = isTripTabStatus(requestedStatus) ? requestedStatus : "";

  const session = await auth();
  const isSignedIn = Boolean(session?.user?.id);
  const statistics = isSignedIn ? await getUserStatistics() : null;

  return (
    <div className="m-4 sm:m-6 lg:m-10">
      <Card className="w-auto mt-6 lg:mt-10 main-card">
        <CardContent className="pt-6">
          {/* The page's `h1`. It used to be an `h2` sitting above an `h1` that
              only rendered for a signed-in user, so a screen reader got the
              headings out of order - and an anonymous visitor got no `h1` at
              all. */}
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Plan your next adventure with AI
          </h1>
          <p className="text-muted-foreground">
            Plan your next adventure with AI in the TravelAI.
          </p>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button
            className="bg-cyan-400 text-black hover:bg-cyan-500 font-semibold h-11 lg:h-9"
            asChild
          >
            <Link href="/new-trip">Start Planning</Link>
          </Button>
        </CardFooter>
      </Card>

      <div className="grid w-full grid-cols-1 gap-4 mt-6 sm:grid-cols-3 sm:gap-6 lg:mt-10">
        <StatsCard
          title="Trips Planned"
          value={statistics?.success ? statistics.tripsCount : 0}
        />
        <StatsCard
          title="Countries"
          value={statistics?.success ? statistics.countries : 0}
        />
        <StatsCard
          title="Destinations"
          value={statistics?.success ? statistics.cities : 0}
        />
      </div>

      {isSignedIn && (
        <div className="flex w-full gap-6 mt-6 lg:mt-10 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">Your trips</h2>
            <TripStatusTabs active={status} />
          </div>
          <UserTrips status={status} page={page} />
        </div>
      )}
    </div>
  );
}
