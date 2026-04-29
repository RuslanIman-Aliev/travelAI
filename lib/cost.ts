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

const normalizeNumber = (value: string) => {
  const normalized = value.replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const formatNumber = (value: number) => {
  if (Number.isInteger(value)) return value.toString();
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
};

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

export const formatEstimatedCostLabel = (value?: string | null) => {
  const parsed = parseEstimatedCost(value);
  if (parsed.isFree) return "Free";
  if (parsed.isUnknown) return value?.trim() || "N/A";
  return parsed.label;
};

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

export const formatBudgetRange = (budget: BudgetRange | null) => {
  if (!budget) return "N/A";
  const minLabel = formatNumber(budget.min);
  const maxLabel = formatNumber(budget.max);
  const base = budget.min === budget.max ? minLabel : `${minLabel}-${maxLabel}`;
  return budget.currency ? `${base} ${budget.currency}` : base;
};
