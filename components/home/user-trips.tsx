import { getUserTrips } from "@/lib/actions/trip.actions";
import { FALLBACK_TRIP_IMAGE } from "@/lib/variables";
import type { TripStatus } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import Badges from "../trip/badges";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import TripCardActions from "./trip-card-actions";

/** What each status is called on a card, and the action that makes sense next. */
const STATUS_LABEL: Record<TripStatus, string> = {
  draft: "Not started",
  generating: "Generating",
  generated: "Ready",
  failed: "Failed",
};

const CTA_LABEL: Record<TripStatus, string> = {
  draft: "Start trip generation",
  generating: "View progress",
  generated: "View Trip Activity",
  failed: "See what went wrong",
};

const UserTrips = async ({
  status = "",
  page = 1,
}: {
  status?: string;
  page?: number;
}) => {
  const tripsResult = await getUserTrips(status, page, 6);
  const pageHref = (nextPage: number) =>
    status ? `/?status=${status}&page=${nextPage}` : `/?page=${nextPage}`;

  if (!tripsResult.success) {
    return (
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your trips right now. Please try again.
      </p>
    );
  }

  const { trips, pagination } = tripsResult;

  if (trips.length === 0) {
    return (
      <p className="text-muted-foreground">
        {status
          ? "No trips with this status yet."
          : "You haven't created any trips yet."}
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-4 w-full">
        {trips.map((trip) => (
          <Card
            key={trip.id}
            className="p-0 pb-2 main-card gap-2 min-[400px]:gap-6"
          >
            <CardHeader className="p-0">
              <CardTitle className="text-xl font-bold min-[400px]:mb-2">
                <div className="relative w-full h-60 min-[500px]:h-80 rounded-lg overflow-hidden">
                  <Image
                    src={trip.imageUrl ?? FALLBACK_TRIP_IMAGE}
                    alt={`Trip to ${trip.destination}`}
                    fill
                    sizes="(min-width: 120rem) 33vw, (min-width: 64rem) calc((100vw - 16rem) / 2), 100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-b from-transparent dark:bg-[linear-gradient(to_right,#09090b66,#23232866)]" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-[20px] min-[400px]:pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-foreground">
                    {trip.title ?? trip.destination}
                  </p>
                  {trip.title && (
                    <p className="truncate text-sm">
                      {[trip.destination, trip.country]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}
                  {!trip.title && trip.country && (
                    <p className="truncate text-sm">{trip.country}</p>
                  )}
                </div>
                <TripCardActions
                  tripId={trip.id}
                  currentTitle={trip.title ?? trip.destination}
                />
              </div>

              <div className="flex flex-wrap justify-start gap-1 pt-2 min-[400px]:justify-center min-[400px]:gap-3 min-[400px]:pt-5">
                <Badges trip={trip} />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-2 pr-2">
              <Badge
                variant={trip.status === "failed" ? "destructive" : "secondary"}
              >
                {STATUS_LABEL[trip.status]}
              </Badge>
              <Button asChild className="h-11 lg:h-9">
                <Link href={`/trip/${trip.id}`}>{CTA_LABEL[trip.status]}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-6">
          <Button
            variant="outline"
            className="h-11 lg:h-9"
            disabled={pagination.currentPage <= 1}
            asChild={pagination.currentPage > 1}
          >
            {pagination.currentPage > 1 ? (
              <Link href={pageHref(pagination.currentPage - 1)}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <span className="flex items-center">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            className="h-11 lg:h-9"
            disabled={pagination.currentPage >= pagination.totalPages}
            asChild={pagination.currentPage < pagination.totalPages}
          >
            {pagination.currentPage < pagination.totalPages ? (
              <Link href={pageHref(pagination.currentPage + 1)}>Next</Link>
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
