export type ParsedCost = {
  amount: number | null;
  currency: string | null;
  isFree: boolean;
  isUnknown: boolean;
  label: string;
};

export type CostSummary = {
  total: number;
  currency: string | null;
  hasMixedCurrency: boolean;
  hasUnknown: boolean;
  hasValues: boolean;
};

export type BudgetRange = {
  min: number;
  max: number;
  currency: string | null;
  raw?: string;
};

const numberPattern = /(\d+(?:[.,]\d+)?)/;
const currencyPattern = /\b[A-Za-z]{3}\b/;

/**
 * Normalizes a number string by replacing commas with dots and converting it to a finite number.
 *
 * @param {string} value - The numerical string to normalize.
 * @returns {number|null} The parsed finite number, or null if the parsing fails.
 */
const normalizeNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

/**
 * Formats a number to a string, rounding it to two decimal places if it's not an integer.
 *
 * @param {number} value - The numerical value to format.
 * @returns {string} The formatted number as a string.
 */
const formatNumber = (value: number) => {
  if (Number.isInteger(value)) return value.toString();
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
};

/**
 * Parses a string representing an estimated cost into a structured `ParsedCost` object.
 *
 * @param {string|null} [value] - The raw cost string to parse.
 * @returns {ParsedCost} An object containing the parsed amount, currency, and flags indicating if it's free or ambiguous.
 */
export const parseEstimatedCost = (value?: string | null): ParsedCost => {
  if (!value) {
    return {
      amount: null,
      currency: null,
      isFree: false,
      isUnknown: true,
      label: "N/A",
    };
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return {
      amount: null,
      currency: null,
      isFree: false,
      isUnknown: true,
      label: "N/A",
    };
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes("free") || lower.includes("no cost")) {
    return {
      amount: 0,
      currency: null,
      isFree: true,
      isUnknown: false,
      label: "Free",
    };
  }

  const amountMatch = trimmed.match(numberPattern);
  const amount = amountMatch ? normalizeNumber(amountMatch[1]) : null;
  const currencyMatch = trimmed.match(currencyPattern);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : null;

  if (amount === null) {
    return {
      amount: null,
      currency,
      isFree: false,
      isUnknown: true,
      label: trimmed,
    };
  }

  const label = currency
    ? `${formatNumber(amount)} ${currency}`
    : formatNumber(amount);

  return {
    amount,
    currency,
    isFree: amount === 0,
    isUnknown: false,
    label,
  };
};

/**
 * Consolidates the parsing logic to return a user-friendly label for an estimated cost string.
 *
 * @param {string|null} [value] - The raw cost string to format.
 * @returns {string} The formatted label for the estimated cost.
 */
export const formatEstimatedCostLabel = (value?: string | null) => {
  const parsed = parseEstimatedCost(value);
  if (parsed.isFree) return "Free";
  if (parsed.isUnknown) return value?.trim() || "N/A";
  return parsed.label;
};

/**
 * Computes a summary from an array of estimated cost strings, aggregating totals and currencies.
 *
 * @param {Array<string|null|undefined>} values - A list of individual cost strings to summarize.
 * @returns {CostSummary} An object holding the total cost and boolean flags for unknowns and mixed currencies.
 */
export const summarizeCosts = (
  values: Array<string | null | undefined>,
): CostSummary => {
  let total = 0;
  let currency: string | null = null;
  let hasMixedCurrency = false;
  let hasUnknown = false;
  let hasValues = false;

  values.forEach((value) => {
    const parsed = parseEstimatedCost(value);

    if (parsed.isUnknown) {
      if (value) hasUnknown = true;
      return;
    }

    hasValues = true;
    total += parsed.amount ?? 0;

    if (parsed.currency) {
      if (!currency) {
        currency = parsed.currency;
      } else if (currency !== parsed.currency) {
        hasMixedCurrency = true;
      }
    }
  });

  return {
    total: Math.round(total * 100) / 100,
    currency,
    hasMixedCurrency,
    hasUnknown,
    hasValues,
  };
};

/**
 * Formats a `CostSummary` object into a readable short string for UI display.
 *
 * @param {CostSummary} summary - The structured cost summary to format.
 * @returns {string} A user-facing string summarizing the costs.
 */
export const formatCostSummary = (summary: CostSummary) => {
  if (!summary.hasValues) return "N/A";
  if (summary.total === 0 && !summary.hasUnknown) return "Free";
  if (summary.hasMixedCurrency) return "Mixed currencies";

  const totalLabel = formatNumber(summary.total);
  const base = summary.currency
    ? `${totalLabel} ${summary.currency}`
    : totalLabel;

  if (summary.hasUnknown) return `${base}+`;
  return base;
};

/**
 * Parses a budget range string into maximum, minimum values, and currency.
 *
 * @param {string|null} [budget] - The raw budget string to parse.
 * @returns {BudgetRange|null} A struct containing min, max, and currency, or null if parsing fails.
 */
export const parseBudgetRange = (
  budget?: string | null,
): BudgetRange | null => {
  if (!budget) return null;
  const matches = budget.match(/\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length === 0) return null;

  const numbers = matches
    .map((match) => normalizeNumber(match))
    .filter((value): value is number => value !== null);

  if (numbers.length === 0) return null;

  const currencyMatch = budget.match(currencyPattern);
  const currency = currencyMatch ? currencyMatch[0].toUpperCase() : null;

  return {
    min: numbers[0],
    max: numbers[numbers.length - 1],
    currency,
    raw: budget,
  };
};

/**
 * Formats a `BudgetRange` object natively to a human-readable string representation.
 *
 * @param {BudgetRange|null} budget - The budget struct to format.
 * @returns {string} The formatted budget label.
 */
export const formatBudgetRange = (budget: BudgetRange | null) => {
  if (!budget) return "N/A";
  const minLabel = formatNumber(budget.min);
  const maxLabel = formatNumber(budget.max);
  const base = budget.min === budget.max ? minLabel : `${minLabel}-${maxLabel}`;
  return budget.currency ? `${base} ${budget.currency}` : base;
};
