import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatEstimatedCostLabel } from "@/lib/cost";
import { Activity } from "@prisma/client";
import { getPlaceTypeMeta } from "./place-type";
export const ActivityCard = ({ activity }: { activity: Activity }) => {
  const placeTypeMeta = getPlaceTypeMeta(activity.placeType);
  const PlaceTypeIcon = placeTypeMeta.icon;
  const title = activity.title ?? activity.placeName ?? "Activity";
  const timeLabel = activity.time?.trim() || "Time TBD";
  const description = activity.description?.trim() || "Details coming soon.";
  const costLabel = formatEstimatedCostLabel(activity.estimatedCost);

  return (
    <>
      <Card
        key={activity.id}
        className="mb-4 p-4 w-full bg-hero border-hero-border shadow-xl"
      >
        <CardHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">{timeLabel}</CardTitle>
              <CardDescription className="text-sm text-white/70">
                {title}
              </CardDescription>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                placeTypeMeta.chipClass
              }`}
            >
              <PlaceTypeIcon
                className={`h-3.5 w-3.5 ${placeTypeMeta.textClass}`}
              />
              <span>{placeTypeMeta.label}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm text-white/70">
            {description}
          </CardDescription>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <CardDescription className="text-sm text-white/70">
            Estimated Cost: {costLabel}
          </CardDescription>
        </CardFooter>
      </Card>
    </>
  );
};
