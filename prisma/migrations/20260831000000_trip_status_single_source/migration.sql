-- Drops `Trip.aiGenerated` and reindexes the dashboard's real query.
--
-- `aiGenerated` was a second answer to a question `status` already answers, and
-- the two could disagree: a run that wrote the days but failed before the final
-- update left `generated` with `aiGenerated = false`. Nothing is lost by
-- dropping it - `status = 'generated'` is exactly the set it described.
--
-- The indexes change for a different reason. `getUserTrips` filters on
-- `(userId)` or `(userId, status)` and always orders by `createdAt DESC`, so an
-- index that stops at the filter columns leaves the sort to be done per page.

-- Backfill first: a trip that finished its itinerary but never got the final
-- flag written is `generated` in substance, and this is the last moment the old
-- column can still say so.
UPDATE "Trip"
SET "status" = 'generated'
WHERE "aiGenerated" = true
  AND "status" <> 'generated';

DROP INDEX IF EXISTS "Trip_userId_aiGenerated_idx";
DROP INDEX IF EXISTS "Trip_userId_idx";

ALTER TABLE "Trip" DROP COLUMN "aiGenerated";

CREATE INDEX "Trip_userId_createdAt_idx" ON "Trip"("userId", "createdAt" DESC);
CREATE INDEX "Trip_userId_status_createdAt_idx" ON "Trip"("userId", "status", "createdAt" DESC);
