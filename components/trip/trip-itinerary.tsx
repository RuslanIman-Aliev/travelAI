import { Button } from "@/components/ui/button";
import { Activity } from "@prisma/client";
import { ArrowDown, ArrowUp, GripVertical, Wallet } from "lucide-react";
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
  isReordering = false,
  onDragStartActivity,
  onDragEndActivity,
  onDropActivity,
  onMoveActivity,
}: {
  activities: Activity[];
  emptyMessage?: string;
  sortMode?: ActivitySortMode;
  draggedActivityId?: string | null;
  isReordering?: boolean;
  onDragStartActivity?: (activityId: string) => void;
  onDragEndActivity?: () => void;
  onDropActivity?: (targetActivityId: string) => void;
  onMoveActivity?: (activityId: string, direction: -1 | 1) => void;
}) => {
  if (!activities.length) {
    return (
      <div className="rounded-xl border border-hero-border bg-hero p-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const dailyCostSummary = summarizeCosts(activities);
  const dailyCostLabel = formatCostSummary(dailyCostSummary);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hero-border bg-hero p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4 text-cyan-400" />
          <span className="font-medium">Estimated day total</span>
          <span className="font-semibold text-foreground">
            {dailyCostLabel}
          </span>
          {dailyCostSummary.hasMixedCurrency && (
            <span className="text-xs text-muted-foreground">
              mixed currency
            </span>
          )}
          {dailyCostSummary.hasUnknown && (
            <span className="text-xs text-muted-foreground">+ unknown</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {sortMode === "manual"
            ? "Use the arrows to reorder. Your order is saved to this trip."
            : "Pick Manual to arrange this day yourself."}
        </div>
      </div>
      {activities.map((activity: Activity, index) => {
        const isLeft = index % 2 === 0;
        const placeTypeMeta = getPlaceTypeMeta(activity.placeType);
        const PlaceTypeIcon = placeTypeMeta.icon;
        const isManualMode = sortMode === "manual";
        const isDragging = draggedActivityId === activity.id;
        const isFirst = index === 0;
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="w-full">
            {isManualMode && onMoveActivity && (
              // The arrows are the reorder control that works everywhere; the
              // drag handle below is a desktop-only convenience on top of them.
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 lg:size-8"
                  aria-label={`Move ${activity.title} up`}
                  disabled={isFirst || isReordering}
                  onClick={() => onMoveActivity(activity.id, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 lg:size-8"
                  aria-label={`Move ${activity.title} down`}
                  disabled={isLast || isReordering}
                  onClick={() => onMoveActivity(activity.id, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <span className="truncate text-xs text-muted-foreground">
                  {activity.title}
                </span>
              </div>
            )}
            <div
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
                "flex w-full flex-col min-[1300px]:flex-row",
                isManualMode && "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-60",
              )}
            >
              <div className="flex w-full min-w-0 justify-start min-[1300px]:w-[45%]">
                {isLeft && <ActivityCard activity={activity} />}
              </div>
              <div className="hidden w-[10%] justify-center items-center min-[1300px]:flex">
                {isManualMode ? (
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted shadow-md",
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
              <div className="flex w-full min-w-0 justify-end min-[1300px]:w-[45%]">
                {!isLeft && <ActivityCard activity={activity} />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TripItinerary;
