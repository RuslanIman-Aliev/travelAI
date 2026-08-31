import { type BudgetRange, type CostSummary } from "@/lib/cost";
import { FALLBACK_TRIP_IMAGE } from "@/lib/variables";
import { Trip } from "@prisma/client";
import Image from "next/image";
import Badges from "./badges";

const TripHeader = ({
  trip,
  costSummary,
  budgetSummary,
}: {
  trip: Trip;
  costSummary: CostSummary;
  budgetSummary: BudgetRange | null;
}) => {
  return (
    <div className="relative w-full h-75 md:h-100 rounded-md overflow-hidden dark:bg-slate-900 bg-slate-50">
      <Image
        // `imageUrl` is genuinely nullable - a Pexels miss leaves it unset - so
        // it needs a fallback rather than a non-null assertion.
        src={trip.imageUrl ?? FALLBACK_TRIP_IMAGE}
        alt={`Trip to ${trip.destination}`}
        fill
        sizes="(min-width: 64rem) calc(100vw - 16rem), 100vw"
        className="object-cover object-center opacity-90"
        priority
      />

      <div className="absolute inset-0 bg-linear-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090bCC,#232328cc)]" />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 p-4 gap-4 sm:gap-8">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-foreground drop-shadow-lg break-words max-w-full">
          {trip.title ? (
            <span className="text-cyan-500 dark:text-cyan-400">
              {trip.title}
            </span>
          ) : (
            <>
              Trip to{" "}
              <span className="text-cyan-500 dark:text-cyan-400">
                {trip.destination}
              </span>
            </>
          )}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          <Badges
            trip={trip}
            costSummary={costSummary}
            budgetSummary={budgetSummary}
          />
        </div>
      </div>
    </div>
  );
};

export default TripHeader;
