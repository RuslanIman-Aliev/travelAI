import { format } from "date-fns";

/**
 * Trip dates are calendar days, not instants: "10 June" means the tenth of June
 * wherever you read it from. A `Date` is an instant, so the two have to be
 * bridged explicitly at both ends.
 *
 * The bug this exists to kill: the picker hands back local midnight, Postgres
 * stores the instant, and the page renders on a server in a different timezone.
 * For a traveller in UTC+3 the "10 June" they picked was stored as
 * `2026-06-09T21:00Z` and rendered as "Jun 9" - and the same shifted date went
 * into the prompt, so the model planned the wrong days.
 *
 * The convention here: a calendar day is represented as UTC midnight. Convert on
 * the way in (from the picker's local midnight) and on the way out (before any
 * timezone-aware formatter touches it).
 */

/**
 * Converts a picker value - local midnight of the day the user clicked - into
 * the UTC-midnight instant that represents that same calendar day.
 *
 * Only correct in the browser, where "local" is the user's timezone. This is why
 * the conversion happens in the form rather than in the server action: by the
 * time the value reaches the server, the day the user meant is no longer
 * recoverable from the instant alone.
 *
 * @param {Date} date - A local-midnight date from the calendar picker.
 * @returns {Date} UTC midnight of the same calendar day.
 */
export const localDayToUtcDate = (date: Date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));

/**
 * Drops the time from an already date-only value. A no-op for anything the form
 * sends, and a defensive floor for a direct caller of the server action, which
 * is a public endpoint like any other.
 *
 * @param {Date} date - Any date.
 * @returns {Date} UTC midnight of that date's UTC calendar day.
 */
export const toUtcDateOnly = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

/**
 * Re-anchors a stored date-only value to local midnight so a timezone-aware
 * formatter prints the calendar day that was stored, not the day that instant
 * happens to fall on wherever the code is running.
 *
 * @param {Date|string} date - A stored date-only value.
 * @returns {Date} Local midnight of the same calendar day.
 */
export const utcDateToLocalDay = (date: Date | string) => {
  const value = date instanceof Date ? date : new Date(date);
  return new Date(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  );
};

/**
 * Formats a stored date-only value identically in every timezone.
 *
 * @param {Date|string} date - A stored date-only value.
 * @param {string} pattern - A `date-fns` format pattern.
 * @returns {string} The formatted calendar day.
 */
export const formatDateOnly = (date: Date | string, pattern: string) =>
  format(utcDateToLocalDay(date), pattern);
