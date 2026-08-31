import {
  formatDateOnly,
  localDayToUtcDate,
  toUtcDateOnly,
  utcDateToLocalDay,
} from "@/lib/dates";

// Trip dates are calendar days. A picker in UTC+3 used to store "10 June" as
// `2026-06-09T21:00Z`, and every reader - the badge, the prompt - saw June 9.
describe("date-only helpers", () => {
  describe("localDayToUtcDate", () => {
    it("keeps the calendar day the picker produced", () => {
      // Local midnight, whatever the runner's timezone happens to be.
      const picked = new Date(2026, 5, 10);

      const stored = localDayToUtcDate(picked);

      expect(stored.toISOString()).toBe("2026-06-10T00:00:00.000Z");
    });

    it("is stable across a whole day of local times", () => {
      const days = [0, 6, 12, 23].map((hour) =>
        localDayToUtcDate(new Date(2026, 5, 10, hour, 30)).toISOString(),
      );

      expect(new Set(days).size).toBe(1);
    });
  });

  describe("toUtcDateOnly", () => {
    it("leaves an already normalised value untouched", () => {
      const stored = new Date("2026-06-10T00:00:00.000Z");

      expect(toUtcDateOnly(stored).toISOString()).toBe(stored.toISOString());
    });

    it("drops the time from a raw instant", () => {
      expect(
        toUtcDateOnly(new Date("2026-06-10T18:45:00Z")).toISOString(),
      ).toBe("2026-06-10T00:00:00.000Z");
    });
  });

  describe("formatDateOnly", () => {
    it("renders the stored calendar day, not the local instant", () => {
      expect(formatDateOnly("2026-06-10T00:00:00.000Z", "MMM d")).toBe(
        "Jun 10",
      );
    });

    // These two pin the behaviour without depending on the runner's timezone: in
    // any zone ahead of UTC a naive `format` renders the late instant as the next
    // day, and in any zone behind UTC it renders the early one as the previous
    // day. One of the two fails wherever the bug is reachable.
    it("is not affected by the runtime timezone", () => {
      expect(formatDateOnly("2026-06-10T23:30:00Z", "yyyy-MM-dd")).toBe(
        "2026-06-10",
      );
      expect(formatDateOnly("2026-06-10T00:30:00Z", "yyyy-MM-dd")).toBe(
        "2026-06-10",
      );
    });

    it("does not slip a day at either end of the year", () => {
      expect(formatDateOnly("2026-01-01T00:00:00.000Z", "yyyy-MM-dd")).toBe(
        "2026-01-01",
      );
      expect(formatDateOnly("2026-12-31T00:00:00.000Z", "yyyy-MM-dd")).toBe(
        "2026-12-31",
      );
    });
  });

  it("round-trips a picked day back to the same day", () => {
    const picked = new Date(2026, 11, 31);

    const rendered = utcDateToLocalDay(localDayToUtcDate(picked));

    expect(rendered.getFullYear()).toBe(2026);
    expect(rendered.getMonth()).toBe(11);
    expect(rendered.getDate()).toBe(31);
  });
});
