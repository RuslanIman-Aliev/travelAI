import {
  formatBudgetRange,
  formatCostSummary,
  formatEstimatedCostLabel,
  budgetComparisonNote,
  compareToBudget,
  getBudgetRange,
  parseCostString,
  summarizeCosts,
  type ActivityCost,
} from "@/lib/cost";

const cost = (overrides: Partial<ActivityCost> = {}): ActivityCost => ({
  estimatedCostCents: null,
  estimatedCostCurrency: null,
  estimatedCostIsFree: false,
  ...overrides,
});

describe("parseCostString", () => {
  it("recognises free values", () => {
    expect(parseCostString("Free")).toEqual({
      cents: 0,
      currency: null,
      isFree: true,
    });
    expect(parseCostString("no cost")).toMatchObject({
      isFree: true,
      cents: 0,
    });
  });

  it("parses amount and currency into minor units", () => {
    expect(parseCostString("20 eur")).toEqual({
      cents: 2000,
      currency: "EUR",
      isFree: false,
    });
  });

  it("handles comma decimal separators", () => {
    expect(parseCostString("12,50 USD")).toMatchObject({ cents: 1250 });
  });

  it("returns a null amount for empty or non-numeric values", () => {
    expect(parseCostString(undefined)).toEqual({
      cents: null,
      currency: null,
      isFree: false,
    });
    expect(parseCostString("depends on season")).toMatchObject({ cents: null });
  });
});

describe("formatEstimatedCostLabel", () => {
  it("formats free, priced and unknown activities", () => {
    expect(formatEstimatedCostLabel(cost({ estimatedCostIsFree: true }))).toBe(
      "Free",
    );
    expect(
      formatEstimatedCostLabel(
        cost({ estimatedCostCents: 2400, estimatedCostCurrency: "USD" }),
      ),
    ).toBe("24 USD");
    expect(formatEstimatedCostLabel(cost())).toBe("N/A");
  });

  it("keeps a fractional amount readable", () => {
    expect(
      formatEstimatedCostLabel(
        cost({ estimatedCostCents: 1250, estimatedCostCurrency: "EUR" }),
      ),
    ).toBe("12.50 EUR");
  });
});

describe("summarizeCosts", () => {
  it("totals same-currency values", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 1000, estimatedCostCurrency: "EUR" }),
      cost({ estimatedCostCents: 500, estimatedCostCurrency: "EUR" }),
      cost({ estimatedCostCents: 0, estimatedCostIsFree: true }),
    ]);

    expect(summary).toEqual({
      totalCents: 1500,
      currency: "EUR",
      hasMixedCurrency: false,
      hasUnknown: false,
      hasValues: true,
    });
  });

  it("flags mixed currency and unknown costs", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 1000, estimatedCostCurrency: "EUR" }),
      cost({ estimatedCostCents: 800, estimatedCostCurrency: "USD" }),
      cost(),
    ]);

    expect(summary.totalCents).toBe(1800);
    expect(summary.hasMixedCurrency).toBe(true);
    expect(summary.hasUnknown).toBe(true);
    expect(summary.hasValues).toBe(true);
  });
});

describe("formatCostSummary", () => {
  const summary = (overrides = {}) => ({
    totalCents: 0,
    currency: null,
    hasMixedCurrency: false,
    hasUnknown: false,
    hasValues: false,
    ...overrides,
  });

  it("formats totals with status suffixes", () => {
    expect(formatCostSummary(summary())).toBe("N/A");
    expect(formatCostSummary(summary({ hasValues: true }))).toBe("Free");
    expect(
      formatCostSummary(
        summary({
          totalCents: 2400,
          currency: "EUR",
          hasValues: true,
          hasMixedCurrency: true,
        }),
      ),
    ).toBe("Mixed currencies");
    expect(
      formatCostSummary(
        summary({
          totalCents: 2400,
          currency: "EUR",
          hasValues: true,
          hasUnknown: true,
        }),
      ),
    ).toBe("24 EUR+");
  });
});

describe("budget helpers", () => {
  it("reads a budget range off the trip columns", () => {
    const range = getBudgetRange({
      budgetMin: 200,
      budgetMax: 800,
      budgetCurrency: "USD",
    });

    expect(range).toEqual({ min: 200, max: 800, currency: "USD" });
    expect(formatBudgetRange(range)).toBe("200-800 USD");
  });

  it("returns null when no budget was captured", () => {
    expect(
      getBudgetRange({
        budgetMin: null,
        budgetMax: null,
        budgetCurrency: null,
      }),
    ).toBeNull();
    expect(formatBudgetRange(null)).toBe("N/A");
  });

  it("collapses an equal min and max", () => {
    const range = getBudgetRange({
      budgetMin: 500,
      budgetMax: 500,
      budgetCurrency: null,
    });

    expect(formatBudgetRange(range)).toBe("500");
  });
});

describe("compareToBudget", () => {
  const budget = { min: 0, max: 100, currency: "USD" };

  it("flags a same-currency total above the maximum", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 15_000, estimatedCostCurrency: "USD" }),
    ]);

    expect(compareToBudget(summary, budget)).toBe("over");
    expect(budgetComparisonNote(summary, budget)).toBeNull();
  });

  it("reports a total within budget", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 5_000, estimatedCostCurrency: "USD" }),
    ]);

    expect(compareToBudget(summary, budget)).toBe("under");
    expect(budgetComparisonNote(summary, budget)).toBeNull();
  });

  // The regression this guards: the old boolean returned `false` here, and the
  // page rendered `false` as a calm "within budget" - on the one trip where the
  // costs are four times the budget and nobody is told.
  it("says a cross-currency comparison is unknown rather than fine", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 40_000, estimatedCostCurrency: "JPY" }),
    ]);

    expect(compareToBudget(summary, budget)).toBe("unknown");
    expect(budgetComparisonNote(summary, budget)).toBe(
      "Budget is in USD, activities are priced in JPY - not comparable",
    );
  });

  it("says mixed activity currencies are unknown", () => {
    const summary = summarizeCosts([
      cost({ estimatedCostCents: 5_000, estimatedCostCurrency: "USD" }),
      cost({ estimatedCostCents: 5_000, estimatedCostCurrency: "EUR" }),
    ]);

    expect(compareToBudget(summary, budget)).toBe("unknown");
    expect(budgetComparisonNote(summary, budget)).toMatch(/several currencies/);
  });

  it("is unknown when there is no budget or no costs", () => {
    expect(compareToBudget(summarizeCosts([cost()]), budget)).toBe("unknown");
    expect(
      compareToBudget(
        summarizeCosts([
          cost({ estimatedCostCents: 999_999, estimatedCostCurrency: "USD" }),
        ]),
        null,
      ),
    ).toBe("unknown");
  });

  it("compares when only one side names a currency", () => {
    const summary = summarizeCosts([cost({ estimatedCostCents: 15_000 })]);

    expect(compareToBudget(summary, budget)).toBe("over");
  });
});
