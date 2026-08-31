import RouteCardActions from "@/components/live-guide/route-card-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import StatusScreen from "@/components/utils/status-screen";
import { getUserLiveGuides } from "@/lib/actions/live-guide.actions";
import { formatDateOnly } from "@/lib/dates";
import { AlertTriangle, ExternalLink, MapPin, Route } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Saved routes" };

interface Props {
  searchParams: Promise<{ page?: string }>;
}

/**
 * The screen the Live Guide was missing.
 *
 * Saving a route wrote two tables and then told the user to "move to your
 * dashboard", where routes did not appear - and could not be reached by any URL.
 */
const LiveGuideHistoryPage = async (props: Props) => {
  const searchParams = await props.searchParams;
  const page = Number(searchParams?.page) || 1;

  const result = await getUserLiveGuides(page, 6);

  if (!result.success) {
    return (
      <StatusScreen
        icon={AlertTriangle}
        tone="danger"
        title="We couldn't load your routes"
        description="Something went wrong on our side. Your saved routes are still there - please try again."
      >
        <Button className="h-11 lg:h-9" asChild>
          <Link href="/live-guide/history">Try again</Link>
        </Button>
      </StatusScreen>
    );
  }

  const { routes, pagination } = result;

  if (routes.length === 0) {
    return (
      <StatusScreen
        icon={Route}
        title="No saved routes yet"
        description="Share your location in the Live Guide, pick the places you want to see, and the route you build is saved here."
      >
        <Button className="h-11 lg:h-9" asChild>
          <Link href="/live-guide">Build a route</Link>
        </Button>
      </StatusScreen>
    );
  }

  const pageHref = (nextPage: number) => `/live-guide/history?page=${nextPage}`;

  return (
    <div className="m-4 flex flex-col gap-6 sm:m-6 lg:m-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Saved routes</h1>
          <p className="text-sm text-muted-foreground">
            {pagination.totalCount} route
            {pagination.totalCount === 1 ? "" : "s"} you built in the Live
            Guide.
          </p>
        </div>
        <Button variant="outline" className="h-11 lg:h-9" asChild>
          <Link href="/live-guide">Build another</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 3xl:grid-cols-3">
        {routes.map((route) => (
          <Card key={route.id} className="main-card gap-3">
            <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
              <div className="min-w-0 space-y-1">
                <p className="truncate font-semibold">
                  {route.startAddress ?? "Unnamed starting point"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {/* `createdAt` is an instant, so rendering it with the server's
                      local timezone would make the date depend on where the app
                      is deployed. The UTC day is at least the same everywhere. */}
                  {formatDateOnly(route.createdAt, "d MMM yyyy")} ·{" "}
                  {(route.radiusMeters / 1000).toFixed(
                    route.radiusMeters % 1000 === 0 ? 0 : 1,
                  )}{" "}
                  km radius
                </p>
              </div>
              <RouteCardActions routeId={route.id} />
            </CardHeader>

            <CardContent className="space-y-3">
              <Badge variant="secondary">
                <MapPin className="mr-1 size-3" />
                {route.places.length} stop
                {route.places.length === 1 ? "" : "s"}
              </Badge>
              <ol className="space-y-1 text-sm text-muted-foreground">
                {route.places.map((place, index) => (
                  <li key={place.id} className="flex gap-2">
                    <span className="tabular-nums text-muted-foreground">
                      {index + 1}.
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">
                        {place.name}
                      </span>
                      {place.category && (
                        <span className="block truncate text-xs">
                          {place.category}
                          {place.distance != null &&
                            ` · ${place.distance} km away`}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>

            {route.mapLink && (
              <CardFooter className="justify-end">
                <Button variant="outline" className="h-11 lg:h-9" asChild>
                  <Link
                    href={route.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open in Google Maps
                    <ExternalLink className="ml-2 size-4" />
                  </Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-4">
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
    </div>
  );
};

export default LiveGuideHistoryPage;
