import { getTripById } from "@/lib/actions/trip.actions";
import { notFound } from "next/navigation";
import TripHeader from "../../../../components/trip/header";
import LoadingSpinner from "@/components/trip/loading";
import { Button } from "@/components/ui/button";
import RedirectButton from "@/components/utils/redirect-button";
import { MapPinOff } from "lucide-react";
import Link from "next/link";
import DayChanger from "../../../../components/trip/dayChanger";
import { parseBudgetRange, summarizeCosts } from "@/lib/cost";
import TripJourneyView from "@/components/trip/trip-journey-view";

const TripPage = async (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) => {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const trip = await getTripById(id);

  if (!trip.success || !trip.trip) {
    notFound();
  }

  const tripDays = trip.trip?.tripDays || [];
  const dayIndex = Number(searchParams.day) || 0;
  const day = tripDays[dayIndex];
  const allActivities = tripDays.flatMap((tripDay) => tripDay.activities || []);
  const totalCostSummary = summarizeCosts(
    allActivities.map((activity) => activity.estimatedCost),
  );
  const budgetSummary = parseBudgetRange(trip.trip.budget);

  return (
    <>
      {trip.trip.status === "failed" && (
        <div className="flex flex-col items-center justify-center h-screen gap-6  p-4">
          {/* 1. Visual Error Indicator */}
          <div className="bg-red-100 p-4 rounded-full">
            <MapPinOff className="w-12 h-12 text-red-500" />
          </div>

          {/* 2. Helpful Message */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold ">
              We couldnt find {trip.trip.destination}
            </h1>
            <p className=" max-w-md">
              Our AI guide got lost looking for that location. Please check the
              spelling or try a more specific city name (e.g., Paris, France).
            </p>
          </div>

          {/* 3. Action Buttons */}
          <RedirectButton />
        </div>
      )}
      {!trip.trip.aiGenerated && <LoadingSpinner tripId={trip.trip.id} />}
      {trip.trip.aiGenerated && trip.trip.status === "generated" && (
        <>
          <TripHeader
            trip={trip.trip}
            costSummary={totalCostSummary}
            budgetSummary={budgetSummary}
          />
          <DayChanger totalDays={trip.trip.tripDays.length} />
          <div className="px-4 pb-8 pt-8 md:px-10">
            <TripJourneyView
              trip={trip.trip}
              day={day ?? null}
              dayIndex={dayIndex}
              budgetSummary={budgetSummary}
              totalCostSummary={totalCostSummary}
            />
          </div>
          <div className="flex justify-center p-10">
            <Button
              asChild
              className="w-full md:w-auto md:min-w-50"
              variant="outline"
            >
              <Link href={"/"}>To all your trips</Link>
            </Button>
          </div>
        </>
      )}
    </>
  );
};

export default TripPage;
