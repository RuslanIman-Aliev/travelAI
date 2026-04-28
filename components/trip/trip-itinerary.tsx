import { Activity } from "@prisma/client";
import { GripVertical, Wallet } from "lucide-react";
import { ActivityCard } from "./activity-card";
import { formatCostSummary, summarizeCosts } from "@/lib/cost";
import { getPlaceTypeMeta } from "./place-type";
import { cn } from "@/lib/utils";
import { type ActivitySortMode } from "@/lib/itinerary";

const TripItinerary = ({
  activities,
  emptyMessage = "No activities planned for this day yet.",
  sortMode = "auto",
  draggedActivityId,
  onDragStartActivity,
  onDragEndActivity,
  onDropActivity,
}: {
  activities: Activity[];
  emptyMessage?: string;
  sortMode?: ActivitySortMode;
  draggedActivityId?: string | null;
  onDragStartActivity?: (activityId: string) => void;
  onDragEndActivity?: () => void;
  onDropActivity?: (targetActivityId: string) => void;
}) => {
  if (!activities.length) {
    return (
      <div className="rounded-xl border border-hero-border bg-hero p-6 text-sm text-white/70">
        {emptyMessage}
      </div>
    );
  }

  const dailyCostSummary = summarizeCosts(
    activities.map((activity) => activity.estimatedCost),
  );
  const dailyCostLabel = formatCostSummary(dailyCostSummary);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hero-border bg-hero p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
          <Wallet className="h-4 w-4 text-cyan-400" />
          <span className="font-medium">Estimated day total</span>
          <span className="font-semibold text-white">{dailyCostLabel}</span>
          {dailyCostSummary.hasMixedCurrency && (
            <span className="text-xs text-white/60">mixed currency</span>
          )}
          {dailyCostSummary.hasUnknown && (
            <span className="text-xs text-white/60">+ unknown</span>
          )}
        </div>
        <div className="text-xs text-white/60">
          Drag cards to reorder when Manual is selected.
        </div>
      </div>
      {activities.map((activity: Activity, index) => {
        const isLeft = index % 2 === 0;
        const placeTypeMeta = getPlaceTypeMeta(activity.placeType);
        const PlaceTypeIcon = placeTypeMeta.icon;
        const isManualMode = sortMode === "manual";
        const isDragging = draggedActivityId === activity.id;
        return (
          <div
            key={activity.id}
            draggable={isManualMode}
            onDragStart={(event) => {
              if (!isManualMode || !onDragStartActivity) return;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", activity.id);
              onDragStartActivity(activity.id);
            }}
            onDragEnd={() => {
              if (!isManualMode || !onDragEndActivity) return;
              onDragEndActivity();
            }}
            onDragOver={(event) => {
              if (!isManualMode) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              if (!isManualMode || !onDropActivity) return;
              event.preventDefault();
              onDropActivity(activity.id);
            }}
            className={cn(
              "flex w-full flex-row max-[1300px]:flex-col",
              isManualMode && "cursor-grab active:cursor-grabbing",
              isDragging && "opacity-60",
            )}
          >
            <div className="flex w-[45%] justify-start max-[1300px]:w-full">
              {isLeft && <ActivityCard activity={activity} />}
            </div>
            <div className="flex w-[10%] justify-center items-center max-[1300px]:hidden">
              {isManualMode ? (
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/20 shadow-md",
                    isDragging && "border-cyan-400/60 bg-cyan-400/10",
                  )}
                  title="Drag to reorder"
                >
                  <GripVertical className="h-5 w-5 text-cyan-400" />
                </div>
              ) : (
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md ${
                    placeTypeMeta.chipClass
                  }`}
                  title={placeTypeMeta.label}
                >
                  <PlaceTypeIcon
                    className={`h-5 w-5 ${placeTypeMeta.textClass}`}
                  />
                </div>
              )}
            </div>
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
