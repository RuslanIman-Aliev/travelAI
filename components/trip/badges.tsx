import { Badge } from "@/components/ui/badge";
import {
  budgetComparisonNote,
  compareToBudget,
  formatBudgetRange,
  formatCostSummary,
  type BudgetRange,
  type CostSummary,
} from "@/lib/cost";
import { formatDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Trip } from "@prisma/client";
import { AlertTriangle, Calendar, MapPin, Wallet } from "lucide-react";

// Tokens, not `text-white`: these chips sit over the hero photo on the trip page
// and on a plain card on the dashboard, and the card is white in light theme -
// which is exactly where white-on-white came from.
const chipClass =
  "bg-background/70 backdrop-blur-sm border-border text-foreground px-3 py-1.5 text-sm";

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
  const comparison = costSummary
    ? compareToBudget(costSummary, budgetSummary ?? null)
    : "unknown";
  const overBudget = comparison === "over";
  // Why the totals cannot be checked against the budget, when they cannot. It
  // used to read as "within budget", which is a different claim entirely.
  const note = costSummary
    ? budgetComparisonNote(costSummary, budgetSummary ?? null)
    : null;

  return (
    <>
      <Badge variant="outline" className={chipClass}>
        <Calendar className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" />
        <span>
          {formatDateOnly(trip.startDate, "MMM d")} -{" "}
          {formatDateOnly(trip.endDate, "MMM d")}
        </span>
      </Badge>

      <Badge variant="outline" className={chipClass}>
        <Wallet className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" />
        Budget: {budgetLabel}
      </Badge>

      <Badge
        variant="outline"
        className={cn(
          chipClass,
          overBudget && "border-destructive/40 text-destructive",
        )}
      >
        <Wallet
          className={cn(
            "w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400",
            overBudget && "text-destructive",
          )}
        />
        Est. Total: {costLabel}
        {overBudget && <AlertTriangle className="w-4 h-4 ml-2 text-rose-300" />}
      </Badge>

      {note && (
        <Badge
          variant="outline"
          className={cn(chipClass, "text-muted-foreground")}
          title={note}
        >
          <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
          <span className="truncate max-w-60">{note}</span>
        </Badge>
      )}

      {trip.interests.length > 0 && (
        <Badge
          variant="outline"
          className={cn(chipClass, "max-w-50 min-[400px]:max-w-none")}
        >
          <MapPin className="w-4 h-4 mr-2 text-cyan-600 dark:text-cyan-400" />
          <span className="truncate max-w-50 md:max-w-none">
            {trip.interests.join(", ")}
          </span>
        </Badge>
      )}
    </>
  );
};

export default Badges;
