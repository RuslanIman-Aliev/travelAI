import {
  formatBudgetRange,
  formatCostSummary,
  formatEstimatedCostLabel,
  parseBudgetRange,
  parseEstimatedCost,
  summarizeCosts,
} from "@/lib/cost";

describe("cost helpers", () => {
  describe("parseEstimatedCost", () => {
    it("parses free values", () => {
      expect(parseEstimatedCost("Free")).toEqual({
        amount: 0,
        currency: null,
        isFree: true,
        isUnknown: false,
        label: "Free",
      });

      expect(parseEstimatedCost("no cost")).toMatchObject({
        isFree: true,
        amount: 0,
      });
    });

    it("parses amount and currency", () => {
      expect(parseEstimatedCost("20 eur")).toEqual({
        amount: 20,
        currency: "EUR",
        isFree: false,
        isUnknown: false,
        label: "20 EUR",
      });
    });

    it("returns unknown for empty or non numeric values", () => {
      expect(parseEstimatedCost(undefined)).toMatchObject({
        isUnknown: true,
        label: "N/A",
      });

      expect(parseEstimatedCost("depends on season")).toMatchObject({
        isUnknown: true,
        label: "depends on season",
      });
    });
  });

  describe("formatEstimatedCostLabel", () => {
    it("formats known and unknown labels", () => {
      expect(formatEstimatedCostLabel("24 usd")).toBe("24 USD");
      expect(formatEstimatedCostLabel("Free")).toBe("Free");
      expect(formatEstimatedCostLabel("")).toBe("N/A");
    });
  });

  describe("summarizeCosts", () => {
    it("summarizes same-currency values", () => {
      const summary = summarizeCosts(["10 EUR", "5 eur", "Free"]);

      expect(summary).toEqual({
        total: 15,
        currency: "EUR",
        hasMixedCurrency: false,
        hasUnknown: false,
        hasValues: true,
      });
    });

    it("flags mixed currency and unknown costs", () => {
      const summary = summarizeCosts(["10 EUR", "8 USD", "depends"]);

      expect(summary.total).toBe(18);
      expect(summary.hasMixedCurrency).toBe(true);
      expect(summary.hasUnknown).toBe(true);
      expect(summary.hasValues).toBe(true);
    });
  });

  describe("formatCostSummary", () => {
    it("formats totals with status suffixes", () => {
      expect(
        formatCostSummary({
          total: 0,
          currency: null,
          hasMixedCurrency: false,
          hasUnknown: false,
          hasValues: false,
        }),
      ).toBe("N/A");

      expect(
        formatCostSummary({
          total: 0,
          currency: null,
          hasMixedCurrency: false,
          hasUnknown: false,
          hasValues: true,
        }),
      ).toBe("Free");

      expect(
        formatCostSummary({
          total: 24,
          currency: "EUR",
          hasMixedCurrency: true,
          hasUnknown: false,
          hasValues: true,
        }),
      ).toBe("Mixed currencies");

      expect(
        formatCostSummary({
          total: 24,
          currency: "EUR",
          hasMixedCurrency: false,
          hasUnknown: true,
          hasValues: true,
        }),
      ).toBe("24 EUR+");
    });
  });

  describe("budget helpers", () => {
    it("parses and formats budget range", () => {
      const parsed = parseBudgetRange("200-800 eur");
      expect(parsed).toEqual({
        min: 200,
        max: 800,
        currency: "EUR",
        raw: "200-800 eur",
      });

      expect(formatBudgetRange(parsed)).toBe("200-800 EUR");
    });

    it("returns null for invalid budget and N/A for empty format", () => {
      expect(parseBudgetRange("budget unknown")).toBeNull();
      expect(formatBudgetRange(null)).toBe("N/A");
    });
  });
});
