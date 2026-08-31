/**
 * Backfills Activity.estimatedCostCents / Currency / IsFree from the legacy
 * free-text Activity.estimatedCost column.
 *
 * It compiles lib/cost.ts with the TypeScript already in devDependencies and
 * calls the project's own `parseCostString`, so migrated rows end up with
 * exactly the values the ingestion path would have produced for the same text.
 * No new dependency, and no second implementation to drift out of sync.
 *
 * Usage:  node scripts/legacy-migration/backfill-activity-costs.mjs [--apply]
 *         Paths below are relative to the repository root - run it from there.
 *         Without --apply it only reports what it would write.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "cost-"));
// Call the local tsc entrypoint through node rather than npx, so this works the
// same on Windows and POSIX.
execFileSync(
  process.execPath,
  [
    path.join("node_modules", "typescript", "bin", "tsc"),
    "lib/cost.ts",
    "--outDir",
    outDir,
    "--module",
    "esnext",
    "--target",
    "es2022",
    "--moduleResolution",
    "bundler",
    "--skipLibCheck",
  ],
  { stdio: "inherit" },
);
const { parseCostString } = await import(
  pathToFileURL(path.join(outDir, "cost.js")).href
);

const prisma = new PrismaClient();
const rows = await prisma.$queryRawUnsafe(
  `SELECT "id", "estimatedCost" FROM "Activity" WHERE "estimatedCost" IS NOT NULL`,
);

const stats = { free: 0, priced: 0, unparsed: 0 };
const samples = [];

for (const row of rows) {
  const parsed = parseCostString(row.estimatedCost);
  if (parsed.isFree) stats.free++;
  else if (parsed.cents != null) stats.priced++;
  else stats.unparsed++;

  if (samples.length < 12) {
    samples.push(
      `${JSON.stringify(row.estimatedCost)} -> ${JSON.stringify(parsed)}`,
    );
  }

  if (APPLY) {
    await prisma.$executeRawUnsafe(
      `UPDATE "Activity"
          SET "estimatedCostCents" = $1,
              "estimatedCostCurrency" = $2,
              "estimatedCostIsFree" = $3
        WHERE "id" = $4`,
      parsed.cents,
      parsed.currency,
      parsed.isFree,
      row.id,
    );
  }
}

console.log("\nsample conversions:");
samples.forEach((s) => console.log("  " + s));
console.log(
  `\nrows with legacy text: ${rows.length}  free: ${stats.free}  priced: ${stats.priced}  amount-not-found: ${stats.unparsed}`,
);
console.log(APPLY ? "APPLIED" : "DRY RUN - rerun with --apply to write");

await prisma.$disconnect();
fs.rmSync(outDir, { recursive: true, force: true });
