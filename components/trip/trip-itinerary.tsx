import { ActivityCard } from "./activity-card";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TripItinerary = ({ activities }: { activities: any[] }) => {
  return (
    <div className="w-full">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {activities.map((activity: any, index) => {
        const isLeft = index % 2 === 0;
        return (
          <div key={activity.id} className="flex w-full flex-row max-[1300px]:flex-col">
            <div className="flex w-[45%] justify-start max-[1300px]:w-full">
              {isLeft && <ActivityCard activity={activity} />}
            </div>
            <div className="flex w-[10%] justify-center items-center max-[1300px]:hidden">Stop</div>
            <div className="flex w-[45%] justify-end max-[1300px]:w-full">
              {!isLeft && <ActivityCard activity={activity} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TripItinerary;
