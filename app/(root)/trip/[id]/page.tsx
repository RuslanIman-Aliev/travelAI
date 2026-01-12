import { getTripById } from "@/lib/actions/trip.actions";
import TripHeader from "../../../../components/trip/header";
import { notFound, redirect } from "next/navigation";

import DayChanger from "../../../../components/trip/dayChanger";
import { MapComponent } from "@/components/map/map-component";
import LoadingSpinner from "@/components/trip/loading";
import TripItinerary from "@/components/trip/trip-itinerary";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import RedirectButton from "@/components/utils/redirect-button";

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
  const activities = day?.activities || [];
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
          <TripHeader trip={trip.trip} />
          <DayChanger totalDays={trip.trip.daysCount} />
          <div className="flex pt-8 pb-8 m-10 gap-5">
            <div className=" w-[60%]">
              <TripItinerary activities={activities} />
            </div>
            <div className="flex w-[40%]">
              <div className="sticky top-[45%] h-[50vh] w-full">
                <div className="h-full w-full rounded-xl overflow-hidden">
                  <MapComponent day={day} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default TripPage;
