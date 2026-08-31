-- Adds the user-editable trip title, and narrows trip/day dates to calendar days.
--
-- NOTE ON EXISTING ROWS: `timestamp -> date` keeps the stored value's date part.
-- Rows written before this migration were saved as the user's local midnight
-- converted to UTC, so a trip created from a positive UTC offset is stored one
-- day early and will keep that day here. The original timezone is not recoverable
-- from the data, so this migration deliberately does not guess at a correction.

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "title" TEXT,
ALTER COLUMN "startDate" SET DATA TYPE DATE,
ALTER COLUMN "endDate" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Day" ALTER COLUMN "date" SET DATA TYPE DATE;
