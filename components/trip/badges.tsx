import { format } from "date-fns";
import { Calendar, Wallet, MapPin } from "lucide-react";
import { Button } from "../ui/button";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Badges = ({ trip }: { trip: any }) => {
  return (
    <>
      {/* Date Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white"
      >
        <Calendar className="w-4 h-4 mr-2 text-cyan-400" />
        <span>
          {format(new Date(trip.startDate), "MMM d")} -{" "}
          {format(new Date(trip.endDate), "MMM d")}
        </span>
      </Button>

      {/* Budget Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white"
      >
        <Wallet className="w-4 h-4 mr-2 text-cyan-400" />
        Budget: {trip.budget || "N/A"}$
      </Button>

      {/* Interests Badge */}
      <Button
        variant="outline"
        className="bg-black/20 backdrop-blur-sm border-white/10 hover:bg-black/40 text-white max-[400px]:max-w-50"
      >
        <MapPin className="w-4 h-4 mr-2 text-cyan-400" />
        <span className="truncate max-w-50 md:max-w-none max-[400px]:max-w-50 ">
          {trip.interests.join(", ")}
        </span>
      </Button>
    </>
  );
};

export default Badges;
