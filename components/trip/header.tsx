import { type BudgetRange, type CostSummary } from "@/lib/cost";
import { Trip } from "@prisma/client";
import Image from "next/image";
import Badges from "./badges";

const TripHeader = async ({
  trip,
  costSummary,
  budgetSummary,
}: {
  trip: Trip;
  costSummary: CostSummary;
  budgetSummary: BudgetRange | null;
}) => {
  const bgImage = trip.imageUrl!;

  return (
    <div className="relative w-full h-75 md:h-100  rounded-md overflow-hidden dark:bg-slate-900 bg-slate-50">
      {/* Background Image */}
      <Image
        src={bgImage}
        alt={`Trip to ${trip.destination}`}
        fill
        className="object-cover object-center opacity-90"
        priority
      />

      {/*  Dark Overlay */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090bCC,#232328cc)]" />

      {/*  Content Container (Centered) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 p-4 gap-8">
        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold dark:text-white text-slate-900 drop-shadow-lg">
          Trip to <span className="text-cyan-400">{trip.destination}</span>
        </h1>

        {/* Buttons Row */}
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
