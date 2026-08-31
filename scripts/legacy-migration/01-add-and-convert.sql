-- Adopt the structured budget/cost schema on a database that predates
-- prisma/migrations (it was created with `db push` from the pre-refactor model).
--
-- Run order:  01-add-and-convert.sql -> backfill-activity-costs.mjs -> 02-drop-legacy.sql
-- Every step here is additive; nothing is dropped until 02.

BEGIN;

-- 0. Keep the original free text forever, so the narrowing that parseCostString
--    performs stays reversible after 02 drops the columns.
CREATE TABLE IF NOT EXISTS "_legacy_trip_budget" AS
  SELECT "id", "budget", "isPublic", "status" FROM "Trip";
CREATE TABLE IF NOT EXISTS "_legacy_activity_cost" AS
  SELECT "id", "estimatedCost" FROM "Activity";

-- 1. New columns, all nullable, so this is safe to run before any backfill.
ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "budgetMin" INTEGER,
  ADD COLUMN IF NOT EXISTS "budgetMax" INTEGER,
  ADD COLUMN IF NOT EXISTS "budgetCurrency" TEXT;

ALTER TABLE "Activity"
  ADD COLUMN IF NOT EXISTS "estimatedCostCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "estimatedCostCurrency" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedCostIsFree" BOOLEAN NOT NULL DEFAULT false;

-- 2. Trip.budget is "MIN-MAX" in all 35 rows (verified), and the form that
--    produced it is labelled "Budget (USD)".
UPDATE "Trip"
SET "budgetMin"      = split_part("budget", '-', 1)::INTEGER,
    "budgetMax"      = split_part("budget", '-', 2)::INTEGER,
    "budgetCurrency" = 'USD'
WHERE "budget" ~ '^[0-9]+-[0-9]+$';

-- 3. status text -> enum. The three values present (draft/generated/failed)
--    are exactly the enum labels, so the cast keeps every row's value.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TripStatus') THEN
    CREATE TYPE "TripStatus" AS ENUM ('draft', 'generating', 'generated', 'failed');
  END IF;
END $$;

ALTER TABLE "Trip" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Trip"
  ALTER COLUMN "status" TYPE "TripStatus" USING "status"::"TripStatus";
ALTER TABLE "Trip" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "Trip" ALTER COLUMN "status" SET NOT NULL;

-- 4. Indexes the schema declares but this database never received.
CREATE INDEX IF NOT EXISTS "Account_userId_idx"             ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Activity_dayId_idx"             ON "Activity"("dayId");
CREATE INDEX IF NOT EXISTS "Day_tripId_idx"                 ON "Day"("tripId");
CREATE UNIQUE INDEX IF NOT EXISTS "Day_tripId_dayNumber_key" ON "Day"("tripId", "dayNumber");
CREATE INDEX IF NOT EXISTS "LiveGuide_userId_idx"           ON "LiveGuide"("userId");
CREATE INDEX IF NOT EXISTS "LiveGuidePlace_liveGuideId_idx" ON "LiveGuidePlace"("liveGuideId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx"             ON "Session"("userId");
CREATE INDEX IF NOT EXISTS "Trip_userId_idx"                ON "Trip"("userId");
CREATE INDEX IF NOT EXISTS "Trip_userId_aiGenerated_idx"    ON "Trip"("userId", "aiGenerated");

COMMIT;
