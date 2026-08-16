import { getUserTrips } from "@/lib/actions/trip.actions";
import { FALLBACK_TRIP_IMAGE } from "@/lib/variables";
import Image from "next/image";
import Link from "next/link";
import Badges from "../trip/badges";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";

const UserTrips = async ({
  value,
  isGenerated,
  page = 1,
}: {
  value: string;
  isGenerated: boolean;
  page?: number;
}) => {
  const tripsResult = await getUserTrips(value, isGenerated, page, 6);

  if (!tripsResult.success) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your trips right now. Please try again.
      </p>
    );
  }

  const { trips, pagination } = tripsResult;

  if (trips.length === 0) {
    return <p>You haven&apos;t created any trips yet.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-4 w-full">
        {trips.map((trip) => (
          <Card key={trip.id} className="p-0 pb-2 main-card max-[400px]:gap-2">
            <CardHeader className="p-0">
              <CardTitle className="text-xl font-bold mb-2 max-[400px]:mb-0">
                <div className="relative w-full h-80 rounded-lg overflow-hidden max-[500px]:h-60">
                  <Image
                    src={trip.imageUrl ?? FALLBACK_TRIP_IMAGE}
                    alt={`Trip to ${trip.destination}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090b66,#23232866)]" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-slate-400 text-[20px] max-[400px]:pt-0">
              {[trip.destination, trip.country].filter(Boolean).join(", ")}
              <div className="flex flex-wrap justify-center gap-3 pt-5 max-[400px]:gap-1 max-[400px]:justify-start max-[400px]:pt-2">
                <Badges trip={trip} />
              </div>
            </CardContent>

            <CardFooter className="flex justify-end pr-2">
              <Button asChild>
                <Link href={`/trip/${trip.id}`}>
                  {isGenerated ? "View Trip Activity" : "Start trip generation"}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-6">
          <Button
            variant="outline"
            disabled={pagination.currentPage <= 1}
            asChild={pagination.currentPage > 1}
          >
            {pagination.currentPage > 1 ? (
              <Link href={`/?page=${pagination.currentPage - 1}`}>
                Previous
              </Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <span className="flex items-center">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={pagination.currentPage >= pagination.totalPages}
            asChild={pagination.currentPage < pagination.totalPages}
          >
            {pagination.currentPage < pagination.totalPages ? (
              <Link href={`/?page=${pagination.currentPage + 1}`}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      )}
    </>
  );
};

export default UserTrips;
