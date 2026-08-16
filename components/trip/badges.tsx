import { Badge } from "@/components/ui/badge";
import {
  formatBudgetRange,
  formatCostSummary,
  isOverBudget as computeIsOverBudget,
  type BudgetRange,
  type CostSummary,
} from "@/lib/cost";
import { cn } from "@/lib/utils";
import { Trip } from "@prisma/client";
import { format } from "date-fns";
import { AlertTriangle, Calendar, MapPin, Wallet } from "lucide-react";

const chipClass =
  "bg-black/20 backdrop-blur-sm border-white/10 text-white px-3 py-1.5 text-sm";

/**
 * Renders the read-only summary chips for a trip.
 *
 * These are labels, not controls, so they are `Badge` (a `span`) rather than
 * `Button` - four fake buttons per trip made every card announce actionable
 * controls that did nothing.
 */
const Badges = ({
  trip,
  costSummary,
  budgetSummary,
}: {
  trip: Trip;
  costSummary?: CostSummary;
  budgetSummary?: BudgetRange | null;
}) => {
  const budgetLabel = formatBudgetRange(budgetSummary ?? null);
  const costLabel = costSummary ? formatCostSummary(costSummary) : "N/A";
  const overBudget = costSummary
    ? computeIsOverBudget(costSummary, budgetSummary ?? null)
    : false;

  return (
    <>
      <Badge variant="outline" className={chipClass}>
        <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
        <span>
          {format(trip.startDate, "MMM d")} - {format(trip.endDate, "MMM d")}
        </span>
      </Badge>

      <Badge variant="outline" className={chipClass}>
        <Wallet className="w-4 h-4 mr-2 text-cyan-400" />
        Budget: {budgetLabel}
      </Badge>

      <Badge
        variant="outline"
        className={cn(
          chipClass,
          overBudget && "border-rose-400/40 text-rose-100",
        )}
      >
        <Wallet
          className={cn(
            "w-4 h-4 mr-2 text-cyan-400",
            overBudget && "text-rose-300",
          )}
        />
        Est. Total: {costLabel}
        {overBudget && <AlertTriangle className="w-4 h-4 ml-2 text-rose-300" />}
      </Badge>

      {trip.interests.length > 0 && (
        <Badge
          variant="outline"
          className={cn(chipClass, "max-[400px]:max-w-50")}
        >
          <MapPin className="w-4 h-4 mr-2 text-cyan-400" />
          <span className="truncate max-w-50 md:max-w-none">
            {trip.interests.join(", ")}
          </span>
        </Badge>
      )}
    </>
  );
};

export default Badges;
