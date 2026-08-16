import LoadingSpinner from "@/components/trip/loading";
import TripHeader from "@/components/trip/header";
import TripJourneyView from "@/components/trip/trip-journey-view";
import DayChanger from "@/components/trip/dayChanger";
import { Button } from "@/components/ui/button";
import RedirectButton from "@/components/utils/redirect-button";
import { getTripById } from "@/lib/actions/trip.actions";
import { getBudgetRange, summarizeCosts } from "@/lib/cost";
import { MapPinOff } from "lucide-react";
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

  if (!result.success) {
    notFound();
  }

  const trip = result.trip;

  // A failed trip still has `aiGenerated === false`, so branching on status
  // rather than on three independent conditions is what stops the error state
  // and the loading spinner from rendering at the same time.
  if (trip.status === "failed") {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-4">
        <div className="bg-red-100 p-4 rounded-full">
          <MapPinOff className="w-12 h-12 text-red-500" />
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">
            We couldn&apos;t find {trip.destination}
          </h1>
          <p className="max-w-md">
            Our AI guide got lost looking for that location. Please check the
            spelling or try a more specific city name (e.g., Paris, France).
          </p>
        </div>

        <RedirectButton />
      </div>
    );
  }

  if (!trip.aiGenerated || trip.status !== "generated") {
    return <LoadingSpinner tripId={trip.id} />;
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
            dayIndex={dayIndex}
            budgetSummary={budgetSummary}
            totalCostSummary={totalCostSummary}
          />
        </Suspense>
      </div>

      <div className="flex justify-center p-10">
        <Button
          asChild
          className="w-full md:w-auto md:min-w-50"
          variant="outline"
        >
          <Link href="/">To all your trips</Link>
        </Button>
      </div>
    </>
  );
};

export default TripPage;
