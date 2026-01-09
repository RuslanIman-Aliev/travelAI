import { getTripById } from "@/lib/actions/trip.actions";
import TripHeader from "./header";
import { notFound } from "next/navigation";
import { ActivityCard } from "./activity";

import DayChanger from "./dayChanger";

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
      <div className="flex pt-8 pb-8 m-10">
        
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
          {/* Map component would be rendered here */}
        </div>
      </div>
    </>
  );
};

export default TripPage;
