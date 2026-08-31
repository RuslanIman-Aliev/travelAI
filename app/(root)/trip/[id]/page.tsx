import LoadingSpinner from "@/components/trip/loading";
import RetryGenerationButton from "@/components/trip/retry-generation-button";
import TripHeader from "@/components/trip/header";
import TripJourneyView from "@/components/trip/trip-journey-view";
import DayChanger from "@/components/trip/dayChanger";
import { Button } from "@/components/ui/button";
import RedirectButton from "@/components/utils/redirect-button";
import StatusScreen from "@/components/utils/status-screen";
import { getTripById } from "@/lib/actions/trip.actions";
import { getBudgetRange, summarizeCosts } from "@/lib/cost";
import { AlertTriangle, MapPinOff } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

const TripPage = async (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) => {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const result = await getTripById(id);

  // A `notFound()` here used to swallow every failure, including Prisma being
  // briefly unreachable - telling the user their trip does not exist when it
  // does. Only a genuine miss is a 404; a lookup failure gets a retry screen.
  if (!result.success) {
    if (result.reason === "not-found") {
      notFound();
    }

    return (
      <StatusScreen
        icon={AlertTriangle}
        tone="danger"
        title="We couldn't load this trip"
        description="Something went wrong on our side. Your trip is still there - please try again."
      >
        <Button className="h-11 lg:h-9" asChild>
          <Link href={`/trip/${id}`}>Try again</Link>
        </Button>
        <Button variant="outline" className="h-11 lg:h-9" asChild>
          <Link href="/">Back to your trips</Link>
        </Button>
      </StatusScreen>
    );
  }

  const trip = result.trip;

  // `status` is the only thing this branches on. There used to be an
  // `aiGenerated` boolean saying the same thing a second time, and every screen
  // here had to keep the two readings in agreement.
  if (trip.status === "failed") {
    return (
      <StatusScreen
        icon={MapPinOff}
        tone="danger"
        title={`We couldn't build an itinerary for ${trip.destination}`}
        description="The generation didn't complete. This is often temporary - if it keeps failing, check the spelling or try a more specific city name (e.g. Paris, France)."
      >
        <RetryGenerationButton tripId={trip.id} />
        <RedirectButton />
      </StatusScreen>
    );
  }

  if (trip.status !== "generated") {
    return <LoadingSpinner tripId={trip.id} status={trip.status} />;
  }

  const tripDays = trip.tripDays;
  const dayIndex = Math.min(
    Math.max(Number(searchParams.day) || 0, 0),
    Math.max(tripDays.length - 1, 0),
  );
  const day = tripDays[dayIndex] ?? null;
  const allActivities = tripDays.flatMap((tripDay) => tripDay.activities);
  const totalCostSummary = summarizeCosts(allActivities);
  const budgetSummary = getBudgetRange(trip);

  return (
    <>
      <TripHeader
        trip={trip}
        costSummary={totalCostSummary}
        budgetSummary={budgetSummary}
      />

      {/* Both children read `useSearchParams`, which needs a Suspense boundary
          so it does not opt the whole route out of streaming. */}
      <Suspense fallback={<div className="h-24" />}>
        <DayChanger totalDays={tripDays.length} />
      </Suspense>

      <div className="px-4 pb-8 pt-8 md:px-10">
        <Suspense fallback={<div className="h-96" />}>
          <TripJourneyView
            day={day}
            budgetSummary={budgetSummary}
            totalCostSummary={totalCostSummary}
          />
        </Suspense>
      </div>

      <div className="flex justify-center p-4 md:p-10">
        <Button
          asChild
          className="w-full h-11 lg:h-9 md:w-auto md:min-w-50"
          variant="outline"
        >
          <Link href="/">To all your trips</Link>
        </Button>
      </div>
    </>
  );
};

export default TripPage;
