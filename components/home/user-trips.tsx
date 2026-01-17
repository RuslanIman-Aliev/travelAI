import { getUserTrips } from "@/lib/actions/trip.actions";
import Image from "next/image";
import Link from "next/link";
import Badges from "../trip/badges";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";

const UserTrips = async ({
  userId,
  value,
  isGenerated,
}: {
  userId: string | undefined;
  value: string;
  isGenerated: boolean;
}) => {
  const trips = await getUserTrips(userId!, value,isGenerated);

  if (!trips.success) {
   
    return <></>;
  }
  const tripList = trips.trips;
  return (
    <>
      <div>
        {tripList?.length === 0 && <p>You dont create any trips yet.</p>}
      </div>
      
      <div className="grid grid-cols-1  lg:grid-cols-2 3xl:grid-cols-3 gap-4 w-full ">
        {tripList?.map((trip) => (
          <Card key={trip.id} className="p-0 pb-2  main-card max-[400px]:gap-2">
           <CardHeader className="p-0">
             <CardTitle className="text-xl font-bold mb-2 max-[400px]:mb-0 ">
              <div className="relative w-full h-80 rounded-lg overflow-hidden max-[500px]:h-60">
                <Image src={trip.imageUrl!} alt="Trip Image" fill className="object-cover "/>
                <div className="absolute inset-0 bg-linear-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090b66,#23232866)]" />
              </div>
              </CardTitle>
           </CardHeader>
           <CardContent className="text-slate-400 text-[20px] max-[400px]:pt-0">
            {trip.destination || ""}, {trip.country || ""}

           <div className="flex flex-wrap justify-center gap-3 pt-5 max-[400px]:gap-1 max-[400px]:justify-start max-[400px]:pt-2">
             <Badges trip={trip} />
           </div>

           </CardContent>

           <CardFooter className="flex justify-end pr-2">
             <Button>
              <Link href={`/trip/${trip.id}`}>{isGenerated ? "View Trip Activity": "Start trip generation"}</Link>
             </Button>
           </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
};

export default UserTrips;
