import { getTripById } from "@/lib/actions/trip.actions";
import TripHeader from "../../../../components/trip/header";
import { notFound } from "next/navigation";
import { ActivityCard } from "../../../../components/trip/activity-card";

import DayChanger from "../../../../components/trip/dayChanger";
import { MapComponent } from "@/components/map/map-component";
import LoadingSpinner from "@/components/trip/loading";
import TripItinerary from "@/components/trip/trip-itinerary";

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
      {!trip.trip.aiGenerated && <LoadingSpinner tripId={trip.trip.id} />}
      {trip.trip.aiGenerated && trip.trip.status==="generated" && (
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
