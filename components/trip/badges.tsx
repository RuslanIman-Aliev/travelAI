import { format } from "date-fns";
import { AlertTriangle, Calendar, MapPin, Wallet } from "lucide-react";
import { Button } from "../ui/button";
import { Trip } from "@prisma/client";
import {
  type BudgetRange,
  type CostSummary,
  formatBudgetRange,
  formatCostSummary,
} from "@/lib/cost";
import { cn } from "@/lib/utils";

const Badges = ({
  trip,
  costSummary,
  budgetSummary,
}: {
  trip: Trip;
  costSummary?: CostSummary;
  budgetSummary?: BudgetRange | null;
}) => {
  const budgetLabel = formatBudgetRange(budgetSummary) || trip.budget || "N/A";
  const costLabel = costSummary ? formatCostSummary(costSummary) : "N/A";
  const isOverBudget = Boolean(
    budgetSummary &&
    costSummary?.hasValues &&
    !costSummary.hasMixedCurrency &&
    budgetSummary.max != null &&
    costSummary.total > budgetSummary.max,
  );

  return (
    <>
      {/* Date Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white"
      >
        <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
        <span>
          {format(new Date(trip.startDate), "MMM d")} -{" "}
          {format(new Date(trip.endDate), "MMM d")}
        </span>
      </Button>

      {/* Budget Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white"
      >
        <Wallet className="w-4 h-4 mr-2 text-cyan-400" />
        Budget: {budgetLabel}
      </Button>

      {/* Estimated Total Badge */}
      <Button
        variant="outline"
        className={cn(
          "bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white",
          isOverBudget && "border-rose-400/40 text-rose-100",
        )}
      >
        <Wallet
          className={cn(
            "w-4 h-4 mr-2 text-cyan-400",
            isOverBudget && "text-rose-300",
          )}
        />
        Est. Total: {costLabel}
        {isOverBudget && (
          <AlertTriangle className="w-4 h-4 ml-2 text-rose-300" />
        )}
      </Button>

      {/* Interests Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white max-[400px]:max-w-50"
      >
        <MapPin className="w-4 h-4 mr-2 text-cyan-400" />
        <span className="truncate max-w-50 md:max-w-none max-[400px]:max-w-50 ">
          {trip.interests.join(", ")}
        </span>
      </Button>
    </>
  );
};

export default Badges;
