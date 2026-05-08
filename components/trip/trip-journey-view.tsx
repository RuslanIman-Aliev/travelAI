"use client";

import { Button } from "@/components/ui/button";
import {
  formatBudgetRange,
  formatCostSummary,
  summarizeCosts,
} from "@/lib/cost";
import {
  reorderManualOrder,
  sortActivities,
  sortActivitiesByManualOrder,
  type ActivitySortMode,
} from "@/lib/itinerary";
import { Activity, Trip } from "@prisma/client";
import { AlertTriangle, ArrowDownUp } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import TripItinerary from "./trip-itinerary";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const MapComponent = dynamic(
  () =>
    import("@/components/map/map-component").then((mod) => mod.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-slate-800 animate-pulse flex items-center justify-center text-slate-500">
        Loading Map...
      </div>
    ),
  },
);

import { type BudgetRange, type CostSummary } from "@/lib/cost";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TripJourneyViewProps = {
  trip: Trip;
  day: {
    activities: Activity[];
    summary?: string | null;
  } | null;
  dayIndex: number;
  budgetSummary: BudgetRange | null;
  totalCostSummary: CostSummary;
};

const sortModes = [
  { value: "auto", label: "Auto" },
  { value: "time", label: "Time" },
  { value: "distance", label: "Distance" },
  { value: "manual", label: "Manual" },
] as const;

const parseSortMode = (value: string | null): ActivitySortMode => {
  if (value === "time" || value === "distance" || value === "manual") {
    return value;
  }
  return "auto";
};

const getManualOrderParamKey = (dayIndex: number) => `order_${dayIndex}`;

const parseManualOrder = (value: string | null, activities: Activity[]) => {
  const orderedIds =
    value
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) ?? [];

  if (orderedIds.length === 0) {
    return activities.map((activity) => activity.id);
  }

  const activityIds = new Set(activities.map((activity) => activity.id));
  const filtered = orderedIds.filter((id) => activityIds.has(id));
  const remaining = activities
    .map((activity) => activity.id)
    .filter((id) => !filtered.includes(id));

  return [...filtered, ...remaining];
};

const TripJourneyView = ({
  trip,
  day,
  dayIndex,
  budgetSummary,
  totalCostSummary,
}: TripJourneyViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const manualOrderParamKey = getManualOrderParamKey(dayIndex);

  const sortMode = useMemo(
    () => parseSortMode(searchParams.get("sort")),
    [searchParams],
  );
  const manualOrder = useMemo(
    () =>
      parseManualOrder(
        searchParams.get(manualOrderParamKey),
        day?.activities || [],
      ),
    [day?.activities, manualOrderParamKey, searchParams],
  );
  const [draggedActivityId, setDraggedActivityId] = useState<string | null>(
    null,
  );
  const dragOrderRef = useRef<string[] | null>(null);

  const visibleActivities = useMemo(() => {
    if (sortMode === "manual") {
      return sortActivitiesByManualOrder(day?.activities || [], manualOrder);
    }

    return sortActivities(day?.activities || [], sortMode);
  }, [day?.activities, manualOrder, sortMode]);

  const updateQueryString = (
    nextSortMode: ActivitySortMode,
    nextManualOrder: string[],
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", nextSortMode);

    if (nextSortMode === "manual") {
      params.set(manualOrderParamKey, nextManualOrder.join(","));
    } else {
      params.delete(manualOrderParamKey);
    }

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const visibleCostSummary = useMemo(() => {
    return summarizeCosts(
      visibleActivities.map((activity) => activity.estimatedCost),
    );
  }, [visibleActivities]);

  const budgetLimit = budgetSummary?.max ?? null;
  const isOverBudget =
    budgetLimit != null &&
    visibleCostSummary.hasValues &&
    !visibleCostSummary.hasMixedCurrency &&
    visibleCostSummary.total > budgetLimit;
  const budgetUsage =
    budgetLimit && budgetLimit > 0
      ? Math.min(visibleCostSummary.total / budgetLimit, 2)
      : 0;
  const budgetTone = isOverBudget
    ? "red"
    : budgetUsage > 0.75
      ? "yellow"
      : "green";

  const handleSortModeChange = (nextMode: ActivitySortMode) => {
    if (isPending) return;

    if (nextMode === "manual") {
      const nextManualOrder = visibleActivities.map((activity) => activity.id);
      updateQueryString(nextMode, nextManualOrder);
      return;
    }

    updateQueryString(nextMode, manualOrder);
  };

  const handleDragStart = (activityId: string) => {
    if (sortMode !== "manual") {
      const nextManualOrder = visibleActivities.map((activity) => activity.id);
      dragOrderRef.current = nextManualOrder;
      updateQueryString("manual", nextManualOrder);
    } else {
      dragOrderRef.current = manualOrder;
    }

    setDraggedActivityId(activityId);
  };

  const handleDragEnd = () => {
    setDraggedActivityId(null);
  };

  const handleDropActivity = (targetId: string) => {
    if (!draggedActivityId) return;

    const nextOrder = reorderManualOrder(
      dragOrderRef.current ?? manualOrder,
      visibleActivities.map((activity) => activity.id),
      draggedActivityId,
      targetId,
    );

    dragOrderRef.current = nextOrder;
    updateQueryString("manual", nextOrder);
    setDraggedActivityId(null);
  };

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border p-4 shadow-lg",
          budgetTone === "red" && "border-rose-400/40 bg-rose-500/10",
          budgetTone === "yellow" && "border-amber-400/40 bg-amber-500/10",
          budgetTone === "green" && "border-emerald-400/40 bg-emerald-500/10",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-white">
              <ArrowDownUp className="h-4 w-4 text-cyan-400" />
              <span>Route sorting</span>
            </div>
            <p className="text-xs text-white/65">
              Sort the day automatically by time, route distance, or manual
              order.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-[0.2em] text-white/50">
              Sort
            </span>
            {sortModes.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                variant="outline"
                onClick={() => handleSortModeChange(mode.value)}
                className={cn(
                  "border-white/10 bg-black/20 text-white hover:bg-black/35",
                  sortMode === mode.value && "border-cyan-400/60 text-cyan-100",
                )}
                disabled={isPending}
              >
                <ArrowDownUp className="mr-2 h-4 w-4" />
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-white">Day budget:</span>
          <span className="text-white/80">
            {formatBudgetRange(budgetSummary) || trip.budget || "N/A"}
          </span>
          <span className="font-medium text-white">Trip total:</span>
          <span className="text-white/80">
            {formatCostSummary(totalCostSummary)}
          </span>
          <span className="font-medium text-white">Visible total:</span>
          <span className="text-white/80">
            {formatCostSummary(visibleCostSummary)}
          </span>
          {isOverBudget && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-100">
              <AlertTriangle className="h-3.5 w-3.5" />
              Over budget
            </span>
          )}
        </div>
      </div>

      <div className="flex pt-2 pb-2 gap-5 max-[1050px]:flex-col">
        <div className="w-[60%] max-[1300px]:w-[70%] max-[1050px]:w-full">
          <TripItinerary
            activities={visibleActivities}
            sortMode={sortMode}
            draggedActivityId={draggedActivityId}
            onDragStartActivity={handleDragStart}
            onDragEndActivity={handleDragEnd}
            onDropActivity={handleDropActivity}
            emptyMessage={
              day?.activities?.length
                ? "No activities available for this day."
                : "No activities planned for this day yet."
            }
          />
        </div>
        <div className="flex w-[40%] max-[1300px]:w-[30%] max-[1050px]:w-full">
          <div className="sticky top-[45%] h-[50vh] w-full max-[1300px]:h-[30vh] max-[1050px]:h-[40vh]">
            <div className="h-full w-full rounded-xl overflow-hidden">
              <MapComponent activities={visibleActivities} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripJourneyView;
