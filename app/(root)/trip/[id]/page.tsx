import { getTripById } from "@/lib/actions/trip.actions";
import TripHeader from "../../../../components/trip/header";
import { notFound } from "next/navigation";
import { ActivityCard } from "../../../../components/trip/activity";

import DayChanger from "../../../../components/trip/dayChanger";
import { MapComponent } from "@/components/map/map-component";

const TripPage = async (props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ day?: string }>;
}) => {
  const { id } = await props.params;
  const searchParams = await props.searchParams;
  const trip = await getTripById(id);

  const tripDays = trip.trip?.tripDays || [];
  const dayIndex = Number(searchParams.day) || 0;
  const day = tripDays[dayIndex];

  if (!trip.success || !trip.trip) {
    notFound();
  }
  return (
    <>
      <TripHeader trip={trip.trip} />
      <DayChanger totalDays={trip.trip.daysCount} />
      <div className="flex pt-8 pb-8 m-10 gap-5">
        <div className=" w-[60%]">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {day?.activities.map((activity: any, index) => {
            const isLeft = index % 2 === 0;
            return (
              <div key={activity.id} className="flex w-full flex-row">
                <div className="flex w-[45%] justify-start ">
                  {isLeft && <ActivityCard activity={activity} />}
                </div>
                <div className="flex w-[10%] justify-center items-center">
                  Stop
                </div>
                <div className="flex w-[45%] justify-end">
                  {!isLeft && <ActivityCard activity={activity} />}
                </div>
              </div>
            );
          })}
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
  );
};

export default TripPage;
