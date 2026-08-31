-- Run ONLY after backfill-activity-costs.mjs reports 0 remaining rows.
-- The original text survives in _legacy_trip_budget / _legacy_activity_cost.

BEGIN;

ALTER TABLE "Trip"
  DROP COLUMN IF EXISTS "budget",
  DROP COLUMN IF EXISTS "isPublic";

-- googlePlaceId / googleSearchQuery / photoUrl are NULL in all 592 rows of this
-- database (verified), so dropping them loses nothing.
ALTER TABLE "Activity"
  DROP COLUMN IF EXISTS "estimatedCost",
  DROP COLUMN IF EXISTS "googlePlaceId",
  DROP COLUMN IF EXISTS "googleSearchQuery",
  DROP COLUMN IF EXISTS "photoUrl";

COMMIT;
