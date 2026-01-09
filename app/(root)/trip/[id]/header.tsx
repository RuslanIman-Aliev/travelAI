import { Button } from "@/components/ui/button";
import { Trip } from "@prisma/client";
import { format } from "date-fns";
import { Calendar, Wallet, MapPin } from "lucide-react"; 
import Image from "next/image";

const TripHeader = async ({ trip }: { trip: Trip }) => {
  const bgImage = trip.imageUrl || "/placeholder-city.jpg";

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
      <div className="absolute inset-0 bg-gradient-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090bCC,#232328cc)]" />

      {/*  Content Container (Centered) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 p-4 gap-8">
        
        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-bold dark:text-white text-slate-900 drop-shadow-lg">
          Trip to <span className="text-cyan-400">{trip.destination}</span>
        </h1>

        {/* Buttons Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          
          {/* Date Badge */}
          <Button variant="outline" className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white">
            <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
            <span>
              {format(new Date(trip.startDate), "MMM d")} -{" "}
              {format(new Date(trip.endDate), "MMM d")}
            </span>
          </Button>

          {/* Budget Badge */}
          <Button variant="outline" className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white">
            <Wallet className="w-4 h-4 mr-2 text-cyan-400" />
            Budget: {trip.budget || "N/A"}$
          </Button>

          {/* Interests Badge */}
          <Button variant="outline" className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white">
            <MapPin className="w-4 h-4 mr-2 text-cyan-400" />
            <span className="truncate max-w-[200px] md:max-w-none">
               {trip.interests.join(", ")}
            </span>
          </Button>
          
        </div>
      </div>
    </div>
  );
};

export default TripHeader;