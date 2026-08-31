/**
 * Cost handling is split in two halves on purpose:
 *
 * - `parseCostString` runs **once**, on the ingestion path, when the model hands
 *   us free text like "20 EUR". Its output is persisted as integer minor units.
 * - Everything else is pure display formatting over already-structured data, so
 *   no regex runs while rendering a page.
 */

/** The cost columns every activity carries. Structural so tests can fake it. */
export type ActivityCost = {
  estimatedCostCents: number | null;
  estimatedCostCurrency: string | null;
  estimatedCostIsFree: boolean;
};

/** The budget columns a trip carries. */
export type TripBudget = {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
};

export type ParsedCost = {
  cents: number | null;
  currency: string | null;
  isFree: boolean;
};

export type CostSummary = {
  totalCents: number;
  currency: string | null;
  hasMixedCurrency: boolean;
  hasUnknown: boolean;
  hasValues: boolean;
};

export type BudgetRange = {
  min: number;
  max: number;
  currency: string | null;
};

const numberPattern = /(\d+(?:[.,]\d+)?)/;
const currencyPattern = /\b[A-Za-z]{3}\b/;
const freeMarkers = ["free", "no cost"];

/**
 * Renders a minor-unit amount as a decimal string, hiding an empty fraction.
 *
 * @param {number} cents - Amount in integer minor units.
 * @returns {string} e.g. `2000` -> `"20"`, `2050` -> `"20.5"`.
 */
const formatMinorUnits = (cents: number) => {
  const major = cents / 100;
  return Number.isInteger(major) ? major.toString() : major.toFixed(2);
};

/**
 * Parses a free-text cost produced by the model into structured values.
 * Intended for the ingestion path only - never call this while rendering.
 *
 * @param {string|null} [value] - Raw cost text, e.g. `"20 EUR"` or `"Free"`.
 * @returns {ParsedCost} Minor units, ISO-ish currency code, and a free flag.
 */
export const parseCostString = (value?: string | null): ParsedCost => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { cents: null, currency: null, isFree: false };
  }

  const lower = trimmed.toLowerCase();
  if (freeMarkers.some((marker) => lower.includes(marker))) {
    return { cents: 0, currency: null, isFree: true };
  }

  const currencyMatch = trimmed.match(currencyPattern);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : null;

  const amountMatch = trimmed.match(numberPattern);
  if (!amountMatch) {
    return { cents: null, currency, isFree: false };
  }

  const amount = Number(amountMatch[1].replace(",", "."));
  if (!Number.isFinite(amount)) {
    return { cents: null, currency, isFree: false };
  }

  const cents = Math.round(amount * 100);
  return { cents, currency, isFree: cents === 0 };
};

/**
 * Formats a single activity's persisted cost for display.
 *
 * @param {ActivityCost} activity - An entity carrying the cost columns.
 * @returns {string} `"Free"`, `"20 EUR"`, `"20"`, or `"N/A"` when unknown.
 */
export const formatEstimatedCostLabel = (activity: ActivityCost) => {
  if (activity.estimatedCostIsFree) return "Free";
  if (activity.estimatedCostCents == null) return "N/A";

  const amount = formatMinorUnits(activity.estimatedCostCents);
  return activity.estimatedCostCurrency
    ? `${amount} ${activity.estimatedCostCurrency}`
    : amount;
};

/**
 * Totals the persisted costs of a set of activities.
 *
 * @param {ActivityCost[]} activities - Activities to aggregate.
 * @returns {CostSummary} Total in minor units plus mixed-currency/unknown flags.
 */
export const summarizeCosts = (activities: ActivityCost[]): CostSummary => {
  let totalCents = 0;
  let currency: string | null = null;
  let hasMixedCurrency = false;
  let hasUnknown = false;
  let hasValues = false;

  for (const activity of activities) {
    if (activity.estimatedCostCents == null) {
      hasUnknown = true;
      continue;
    }

    hasValues = true;
    totalCents += activity.estimatedCostCents;

    if (!activity.estimatedCostCurrency) continue;

    if (!currency) {
      currency = activity.estimatedCostCurrency;
    } else if (currency !== activity.estimatedCostCurrency) {
      hasMixedCurrency = true;
    }
  }

  return { totalCents, currency, hasMixedCurrency, hasUnknown, hasValues };
};

/**
 * Formats an aggregated cost summary for display.
 *
 * @param {CostSummary} summary - The summary to render.
 * @returns {string} A short user-facing label.
 */
export const formatCostSummary = (summary: CostSummary) => {
  if (!summary.hasValues) return "N/A";
  if (summary.hasMixedCurrency) return "Mixed currencies";
  if (summary.totalCents === 0 && !summary.hasUnknown) return "Free";

  const amount = formatMinorUnits(summary.totalCents);
  const base = summary.currency ? `${amount} ${summary.currency}` : amount;

  return summary.hasUnknown ? `${base}+` : base;
};

/**
 * Reads a trip's budget columns into a range, or null when no budget was set.
 *
 * @param {TripBudget} trip - An entity carrying the budget columns.
 * @returns {BudgetRange|null} The structured range, or null when unset.
 */
export const getBudgetRange = (trip: TripBudget): BudgetRange | null => {
  if (trip.budgetMin == null && trip.budgetMax == null) return null;

  const min = trip.budgetMin ?? trip.budgetMax ?? 0;
  const max = trip.budgetMax ?? trip.budgetMin ?? 0;

  return { min, max, currency: trip.budgetCurrency };
};

/**
 * Formats a budget range for display.
 *
 * @param {BudgetRange|null} budget - The range to render.
 * @returns {string} e.g. `"200-800 USD"`, or `"N/A"` when there is no budget.
 */
export const formatBudgetRange = (budget: BudgetRange | null) => {
  if (!budget) return "N/A";

  const base =
    budget.min === budget.max
      ? budget.min.toString()
      : `${budget.min}-${budget.max}`;

  return budget.currency ? `${base} ${budget.currency}` : base;
};

/**
 * The outcome of comparing spending to a budget.
 *
 * `unknown` is a real answer, not a missing one. The budget is captured in USD
 * while the model prices activities in the destination's currency, so a trip to
 * Paris compares 900 USD against costs in EUR - and the old boolean returned
 * `false` for that, which the page rendered as a calm green "within budget".
 * That is exactly the trip where the warning mattered.
 */
export type BudgetComparison = "under" | "over" | "unknown";

/**
 * Compares aggregated activity costs to a budget, refusing to guess when the two
 * are not denominated the same way.
 *
 * @param {CostSummary} summary - Aggregated activity costs.
 * @param {BudgetRange|null} budget - The trip's budget range.
 * @returns {BudgetComparison} Whether spending is over, under, or not comparable.
 */
export const compareToBudget = (
  summary: CostSummary,
  budget: BudgetRange | null,
): BudgetComparison => {
  if (!budget || !summary.hasValues) return "unknown";
  if (summary.hasMixedCurrency) return "unknown";

  if (
    summary.currency &&
    budget.currency &&
    summary.currency !== budget.currency
  ) {
    return "unknown";
  }

  return summary.totalCents > budget.max * 100 ? "over" : "under";
};

/**
 * Explains an `unknown` comparison in the user's terms.
 *
 * @param {CostSummary} summary - Aggregated activity costs.
 * @param {BudgetRange|null} budget - The trip's budget range.
 * @returns {string|null} A short reason, or null when the two are comparable.
 */
export const budgetComparisonNote = (
  summary: CostSummary,
  budget: BudgetRange | null,
): string | null => {
  if (compareToBudget(summary, budget) !== "unknown") return null;
  if (!budget) return null;
  if (!summary.hasValues) return "No activity costs to compare yet";
  if (summary.hasMixedCurrency) {
    return "Activities are priced in several currencies - totals cannot be compared to the budget";
  }

  if (
    summary.currency &&
    budget.currency &&
    summary.currency !== budget.currency
  ) {
    return `Budget is in ${budget.currency}, activities are priced in ${summary.currency} - not comparable`;
  }

  return null;
};
