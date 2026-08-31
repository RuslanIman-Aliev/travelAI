"use client";

import { Button } from "@/components/ui/button";
import {
  budgetComparisonNote,
  compareToBudget,
  formatBudgetRange,
  formatCostSummary,
  summarizeCosts,
} from "@/lib/cost";
import { reorderDayActivities } from "@/lib/actions/trip.actions";
import { formatDateOnly } from "@/lib/dates";
import {
  moveInOrder,
  reorderManualOrder,
  sortActivities,
  sortActivitiesByManualOrder,
  sortByUserOrder,
  type ActivitySortMode,
} from "@/lib/itinerary";
import { Activity } from "@prisma/client";
import { AlertTriangle, ArrowDownUp } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import TripItinerary from "./trip-itinerary";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const MapComponent = dynamic(
  () =>
    import("@/components/map/map-component").then((mod) => mod.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-muted animate-pulse flex items-center justify-center text-muted-foreground">
        Loading Map...
      </div>
    ),
  },
);

import { type BudgetRange, type CostSummary } from "@/lib/cost";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type TripJourneyViewProps = {
  day: {
    id: string;
    activities: Activity[];
    date?: Date | string | null;
    summary?: string | null;
  } | null;
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

const TripJourneyView = ({
  day,
  budgetSummary,
  totalCostSummary,
}: TripJourneyViewProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const sortMode = useMemo(
    () => parseSortMode(searchParams.get("sort")),
    [searchParams],
  );

  // The saved arrangement, straight from the database. It used to be read out of
  // an `order_<n>` query parameter, which meant it was gone on the next visit.
  const persistedOrder = useMemo(
    () => sortByUserOrder(day?.activities ?? []).map((activity) => activity.id),
    [day?.activities],
  );

  // Shown immediately while the save is in flight, so a reorder does not wait on
  // a round trip. Dropped as soon as it stops describing the day on screen -
  // switching days, or an itinerary that changed underneath.
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);

  const manualOrder = useMemo(() => {
    if (!pendingOrder) return persistedOrder;

    const persisted = new Set(persistedOrder);
    const describesThisDay =
      pendingOrder.length === persisted.size &&
      pendingOrder.every((id) => persisted.has(id));

    return describesThisDay ? pendingOrder : persistedOrder;
  }, [pendingOrder, persistedOrder]);

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

  // Only the view preference lives in the URL now; the arrangement itself is a
  // property of the trip, not of the link.
  const updateSortMode = (nextSortMode: ActivitySortMode) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sort", nextSortMode);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const saveOrder = (nextOrder: string[]) => {
    if (!day) return;

    setPendingOrder(nextOrder);

    startTransition(async () => {
      const res = await reorderDayActivities(day.id, nextOrder);

      if (!res.success) {
        // Fall back to what the server still believes, rather than leaving the
        // page showing an order that was never saved.
        setPendingOrder(null);
        toast.error(res.message);
        return;
      }

      router.refresh();
    });
  };

  const visibleCostSummary = useMemo(
    () => summarizeCosts(visibleActivities),
    [visibleActivities],
  );

  const budgetLimitCents = budgetSummary ? budgetSummary.max * 100 : null;
  const comparison = compareToBudget(visibleCostSummary, budgetSummary);
  const isOverBudget = comparison === "over";
  const budgetNote = budgetComparisonNote(visibleCostSummary, budgetSummary);
  const budgetUsage =
    budgetLimitCents && budgetLimitCents > 0
      ? Math.min(visibleCostSummary.totalCents / budgetLimitCents, 2)
      : 0;
  // A comparison we cannot make gets its own neutral tone. Painting it green
  // told the user their spending had been checked against the budget when the
  // two were denominated differently and nothing had been checked at all.
  const budgetTone =
    comparison === "unknown"
      ? "neutral"
      : isOverBudget
        ? "red"
        : budgetUsage > 0.75
          ? "yellow"
          : "green";

  const handleSortModeChange = (nextMode: ActivitySortMode) => {
    if (isPending) return;

    // Switching into Manual adopts whatever is currently on screen as the
    // starting arrangement, so the list does not jump under the user.
    if (nextMode === "manual") {
      const adopted = visibleActivities.map((activity) => activity.id);
      if (adopted.join(",") !== manualOrder.join(",")) {
        saveOrder(adopted);
      }
    }

    updateSortMode(nextMode);
  };

  const handleDragStart = (activityId: string) => {
    dragOrderRef.current = manualOrder;
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
    setDraggedActivityId(null);
    saveOrder(nextOrder);
  };

  // HTML5 drag-and-drop never fires on touch, so on a phone Manual mode could be
  // selected and then did nothing at all. These work everywhere.
  const handleMoveActivity = (activityId: string, direction: -1 | 1) => {
    if (isPending) return;

    const nextOrder = moveInOrder(manualOrder, activityId, direction);
    if (nextOrder === manualOrder) return;

    saveOrder(nextOrder);
  };

  // The model has been writing a date and a one-line summary for every day since
  // the beginning; neither was rendered anywhere, so the itinerary showed "Day 3"
  // and nothing about which day that actually is.
  const daySummary = day?.summary?.trim();

  return (
    <div className="space-y-4">
      {(day?.date || daySummary) && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-1">
          {day?.date && (
            <p className="text-base font-medium text-foreground">
              {formatDateOnly(day.date, "EEEE, d MMMM")}
            </p>
          )}
          {daySummary && (
            <p className="text-sm text-muted-foreground">{daySummary}</p>
          )}
        </div>
      )}

      <div
        className={cn(
          "rounded-2xl border p-4 shadow-lg",
          budgetTone === "red" && "border-rose-400/40 bg-rose-500/10",
          budgetTone === "yellow" && "border-amber-400/40 bg-amber-500/10",
          budgetTone === "green" && "border-emerald-400/40 bg-emerald-500/10",
          budgetTone === "neutral" && "border-border bg-muted/40",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              <ArrowDownUp className="h-4 w-4 text-cyan-400" />
              <span>Route sorting</span>
            </div>
            <p className="text-sm lg:text-xs text-muted-foreground">
              Sort the day automatically by time, route distance, or manual
              order.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm lg:text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Sort
            </span>
            {sortModes.map((mode) => (
              <Button
                key={mode.value}
                type="button"
                variant="outline"
                onClick={() => handleSortModeChange(mode.value)}
                className={cn(
                  "h-11 lg:h-9 border-border bg-muted text-foreground hover:bg-muted/70",
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
          <span className="font-medium text-foreground">Day budget:</span>
          <span className="text-muted-foreground">
            {formatBudgetRange(budgetSummary)}
          </span>
          <span className="font-medium text-foreground">Trip total:</span>
          <span className="text-muted-foreground">
            {formatCostSummary(totalCostSummary)}
          </span>
          <span className="font-medium text-foreground">Visible total:</span>
          <span className="text-muted-foreground">
            {formatCostSummary(visibleCostSummary)}
          </span>
          {isOverBudget && (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-100">
              <AlertTriangle className="h-3.5 w-3.5" />
              Over budget
            </span>
          )}
          {budgetNote && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              {budgetNote}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col pt-2 pb-2 gap-5 min-[1050px]:flex-row">
        <div className="w-full min-w-0 min-[1050px]:w-[70%] min-[1300px]:w-[60%]">
          <TripItinerary
            activities={visibleActivities}
            sortMode={sortMode}
            draggedActivityId={draggedActivityId}
            isReordering={isPending}
            onDragStartActivity={handleDragStart}
            onDragEndActivity={handleDragEnd}
            onDropActivity={handleDropActivity}
            onMoveActivity={handleMoveActivity}
            emptyMessage={
              day?.activities?.length
                ? "No activities available for this day."
                : "No activities planned for this day yet."
            }
          />
        </div>
        <div className="flex w-full min-w-0 min-[1050px]:w-[30%] min-[1300px]:w-[40%]">
          <div className="h-[55dvh] w-full min-[1050px]:sticky min-[1050px]:top-[45%] min-[1050px]:h-[30dvh] min-[1300px]:h-[50dvh]">
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
