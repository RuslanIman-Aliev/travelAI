# Legacy migration (historical — do not run)

A one-off package that moved a database created with `prisma db push`, before
`prisma/migrations/` existed, onto the structured budget and cost schema.

**It has already been applied, and it is not part of the migration history.**
`prisma/migrations/` is the only source of truth for the schema; `prisma migrate
deploy` is the only way to change a database. These files live here rather than
under `prisma/` precisely so nobody has to work out which of the two to run.

They are kept because they are the record of how the free-text `Trip.budget` and
`Activity.estimatedCost` columns became the integer minor units the application
reads today, and because the rollback data they preserved still exists.

## What it did

| Step | File                          | Effect                                                                                                                                                                                 |
| ---- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `01-add-and-convert.sql`      | Copies the legacy columns into `_legacy_trip_budget` / `_legacy_activity_cost`, then adds the new nullable columns. Purely additive.                                                   |
| 2    | `backfill-activity-costs.mjs` | Fills the new cost columns by calling the application's own `parseCostString`, so migrated rows match what ingestion would have written. `--apply` to write; without it, reports only. |
| 3    | `02-drop-legacy.sql`          | Drops the old columns. Run only after step 2 reported zero remaining rows.                                                                                                             |

The `_legacy_*` tables were left in place on purpose: they are what makes step 3
reversible. Dropping them is a separate decision, and nothing in the application
reads them.
