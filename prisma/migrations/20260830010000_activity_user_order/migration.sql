-- Persists the order a user arranged a day into.
--
-- It used to live in the query string, so it was lost on the next visit and the
-- URL grew a comma-separated id list per day. Nullable on purpose: null means
-- "never rearranged", which is what lets `order` stay the source of truth for
-- every itinerary that has not been touched.

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "userOrder" INTEGER;
