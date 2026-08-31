"use client";

import {
  GoogleMap,
  InfoWindow,
  Polyline,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { darkMapStyle } from "./map-dark-style";
import { useTheme } from "next-themes";
import { CSSProperties, useMemo, useState } from "react";
import { Activity } from "@prisma/client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEstimatedCostLabel } from "@/lib/cost";
import { getPlaceTypeMeta } from "@/components/trip/place-type";
import { buildRoutePath, getRouteAnchor } from "@/lib/itinerary";
import type { RenderablePlaceTypeKey } from "@/lib/place-types";

/**
 * Marker colour per place type, matching the chip colours the itinerary uses for
 * the same type. A `Record` over the canonical keys, so a type added to
 * `PLACE_TYPE_LABELS` without a pin here fails to compile instead of dropping to
 * the fallback pin on the map.
 */
const markerColorByPlaceType: Record<RenderablePlaceTypeKey, string> = {
  sightseeing: "#38bdf8",
  food: "#fbbf24",
  relax: "#34d399",
  adventure: "#fb7185",
  shopping: "#fb923c",
  culture: "#2dd4bf",
  activity: "#94a3b8",
};

/** The route polyline's colour, so the selected pin reads as part of the route. */
const SELECTED_MARKER_COLOR = "#22d3ee";

/**
 * Builds a pin as an inline data URI.
 *
 * The pins used to be PNGs on `maps.google.com/mapfiles`, which meant one
 * external request per point of the itinerary, on a path Google has never
 * promised to keep. Drawing them here costs no requests, scales without
 * blurring, and lets the colours match the activity chips.
 *
 * @param {string} fill - The pin's fill colour.
 * @param {boolean} [emphasised] - Whether to draw the larger, selected pin.
 * @returns {string} A `data:` URL usable as a marker icon.
 */
const markerIconUrl = (fill: string, emphasised = false) => {
  const width = emphasised ? 34 : 26;
  const height = emphasised ? 48 : 37;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 26 37"><path d="M13 .8C6.3.8.9 6.2.9 12.9c0 8.7 10.6 21.8 11 22.4a1.4 1.4 0 0 0 2.2 0c.4-.6 11-13.7 11-22.4C25.1 6.2 19.7.8 13 .8Z" fill="${fill}" stroke="#0f172a" stroke-width="1.6"/><circle cx="13" cy="12.9" r="4.6" fill="#0f172a" fill-opacity=".85"/></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const defaultMapContainerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "15px",
};

const baseMapOptions = {
  zoomControl: true,
  gestureHandling: "auto",
  mapTypeId: "roadmap",
  mapTypeControl: false,
};

const routeLineOptions = {
  strokeColor: "#22d3ee",
  strokeOpacity: 0.95,
  strokeWeight: 4,
  geodesic: true,
  clickable: false,
  zIndex: 1,
};

const MapComponent = ({ activities }: { activities: Activity[] }) => {
  // The dark tiles used to be applied unconditionally, so a light-theme user got
  // a dark map in the middle of a light page. `resolvedTheme` is what accounts
  // for the "system" setting, which is the default.
  const { resolvedTheme } = useTheme();
  const mapOptions = useMemo(
    () => ({
      ...baseMapOptions,
      styles: resolvedTheme === "dark" ? darkMapStyle : undefined,
    }),
    [resolvedTheme],
  );

  const mapCenter = useMemo(() => {
    const anchor = getRouteAnchor(activities);

    if (anchor?.latitude != null && anchor?.longitude != null) {
      return {
        lat: anchor.latitude,
        lng: anchor.longitude,
      };
    }
    return { lat: 0, lng: 0 };
  }, [activities]);

  const mapZoom = mapCenter.lat === 0 && mapCenter.lng === 0 ? 2 : 13;

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );

  const { isLoaded, loadError } = useJsApiLoader({
    id: "google-map-script",
    // Browser-only key: it ships in the bundle, so it must be HTTP-referrer
    // restricted and must not be the key used for server-side Places calls.
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "",
    version: "weekly",
  });

  const getActivityQuery = (activity: Activity) =>
    activity.placeName ?? activity.title ?? "";

  const defaultQuery = useMemo(() => {
    const firstNamed = activities.find(
      (activity) => activity.placeName || activity.title,
    );
    return firstNamed?.placeName || firstNamed?.title || "travel";
  }, [activities]);

  const defaultMapsUrl = useMemo(() => {
    const firstWithCoords = activities.find(
      (activity) => activity.latitude != null && activity.longitude != null,
    );

    if (
      firstWithCoords?.latitude != null &&
      firstWithCoords.longitude != null
    ) {
      return `https://www.google.com/maps/search/?api=1&query=${
        firstWithCoords.latitude
      },${firstWithCoords.longitude}`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      defaultQuery,
    )}`;
  }, [activities, defaultQuery]);

  const routePath = useMemo(() => buildRoutePath(activities), [activities]);

  const openGoogleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(
      trimmedQuery,
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openGoogleMaps = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openActivityMaps = (activity: Activity) => {
    if (activity.latitude != null && activity.longitude != null) {
      openGoogleMaps(
        `https://www.google.com/maps/search/?api=1&query=${activity.latitude},${
          activity.longitude
        }`,
      );
      return;
    }

    const query = getActivityQuery(activity);
    if (query) {
      openGoogleMaps(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          query,
        )}`,
      );
    }
  };

  // Selecting a marker opens its info window and nothing else. It used to also
  // open a Google search in a new tab, so looking at a pin navigated away from
  // the itinerary - and got caught by pop-up blockers when it did not. Going to
  // Google is now a button inside the window, where the user asks for it.
  const handleMarkerClick = (activity: Activity) => {
    setSelectedActivity(activity);
  };

  const getMarkerIcon = (activity: Activity) => {
    if (selectedActivity?.id === activity.id) {
      return markerIconUrl(SELECTED_MARKER_COLOR, true);
    }

    const meta = getPlaceTypeMeta(activity.placeType);
    return markerIconUrl(markerColorByPlaceType[meta.key]);
  };

  if (loadError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-hero-border bg-hero p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Map unavailable</p>
          <p className="text-xs text-muted-foreground">
            You can still explore locations in Google Maps.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => openGoogleMaps(defaultMapsUrl)}
          >
            Open Google Maps
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => openGoogleSearch(defaultQuery)}
          >
            Search Google
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-hero-border bg-hero text-sm text-muted-foreground">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={defaultMapContainerStyle}
        center={mapCenter}
        zoom={mapZoom}
        options={mapOptions}
      >
        {routePath.length > 1 && (
          <Polyline path={routePath} options={routeLineOptions} />
        )}
        {/* `Marker` is deprecated in favour of `AdvancedMarkerElement`, and
            staying on it is a deliberate choice, not an oversight.
            `AdvancedMarkerElement` requires a cloud-configured `mapId`, and a
            map that carries a `mapId` ignores the `styles` array entirely -
            which is how the dark theme above is applied. Migrating therefore
            means moving the map's theming into the Google Cloud console, where
            this repository cannot see or review it, and giving up the
            `resolvedTheme` switch. `@react-google-maps/api` also has no
            advanced-marker component, so it would mean changing map libraries
            as well. The external icon requests that made this finding expensive
            are gone; what is left is a console warning. */}
        {activities.map((activity: Activity) => {
          if (activity.latitude == null || activity.longitude == null)
            return null;
          return (
            <Marker
              key={activity.id}
              position={{ lat: activity.latitude, lng: activity.longitude }}
              title={activity.placeName ?? activity.title}
              icon={getMarkerIcon(activity)}
              onClick={() => handleMarkerClick(activity)}
            />
          );
        })}
        {selectedActivity && (
          <InfoWindow
            position={{
              lat: selectedActivity.latitude ?? mapCenter.lat,
              lng: selectedActivity.longitude ?? mapCenter.lng,
            }}
            onCloseClick={() => setSelectedActivity(null)}
          >
            <div className="min-w-56 max-w-64 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {selectedActivity.placeName ??
                      selectedActivity.title ??
                      "Activity"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {getPlaceTypeMeta(selectedActivity.placeType).label} ·{" "}
                    {selectedActivity.time?.trim() || "Time TBD"}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  {getPlaceTypeMeta(selectedActivity.placeType).label}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                {selectedActivity.description?.trim() || "Details coming soon."}
              </p>
              <div className="space-y-2 text-xs text-slate-700">
                <span className="block">
                  Estimated: {formatEstimatedCostLabel(selectedActivity)}
                </span>
                {/* Both ways out of the map live here now, as buttons the user
                    presses, rather than one of them firing on marker click. */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                    onClick={() => openActivityMaps(selectedActivity)}
                    type="button"
                  >
                    Open Maps
                  </button>
                  <button
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                    onClick={() =>
                      openGoogleSearch(getActivityQuery(selectedActivity))
                    }
                    type="button"
                  >
                    Search Google
                  </button>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      <div className="absolute bottom-8 right-3 sm:bottom-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          className="h-11 lg:h-9"
          onClick={() => openGoogleMaps(defaultMapsUrl)}
        >
          Open Maps
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export { MapComponent };
