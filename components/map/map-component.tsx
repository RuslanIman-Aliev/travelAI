"use client";

import {
  GoogleMap,
  InfoWindow,
  Polyline,
  Marker,
  useJsApiLoader,
} from "@react-google-maps/api";
import { darkMapStyle } from "./map-dark-style";
import { CSSProperties, useMemo, useState } from "react";
import { Activity } from "@prisma/client";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatEstimatedCostLabel } from "@/lib/cost";
import { getPlaceTypeMeta } from "@/components/trip/place-type";
import { buildRoutePath, getRouteAnchor } from "@/lib/itinerary";

const markerIconByPlaceType: Record<string, string> = {
  sightseeing: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  food: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  relax: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  adventure: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  shopping: "https://maps.google.com/mapfiles/ms/icons/purple-dot.png",
  culture: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
  activity: "https://maps.google.com/mapfiles/ms/icons/pink-dot.png",
};

const defaultMapContainerStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: "15px",
};

const defaultMapOptions = {
  zoomControl: true,
  gestureHandling: "auto",
  styles: darkMapStyle,
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
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAP_API as string,
    version: "weekly",
  });

  const getActivityQuery = (activity: Activity) =>
    activity.googleSearchQuery ?? activity.placeName ?? activity.title ?? "";

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

  const handleMarkerClick = (activity: Activity) => {
    setSelectedActivity(activity);
    openGoogleSearch(getActivityQuery(activity));
  };

  const getMarkerIcon = (activity: Activity) => {
    const meta = getPlaceTypeMeta(activity.placeType);
    const isSelected = selectedActivity?.id === activity.id;

    if (isSelected) {
      return "https://maps.google.com/mapfiles/ms/icons/ltblue-dot.png";
    }

    return markerIconByPlaceType[meta.key] ?? markerIconByPlaceType.activity;
  };

  if (loadError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border border-hero-border bg-hero p-6 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-400" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-white">Map unavailable</p>
          <p className="text-xs text-white/70">
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
      <div className="flex h-full w-full items-center justify-center rounded-xl border border-hero-border bg-hero text-sm text-white/70">
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
        options={defaultMapOptions}
      >
        {routePath.length > 1 && (
          <Polyline path={routePath} options={routeLineOptions} />
        )}
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
              <div className="flex items-center justify-between gap-3 text-xs text-slate-700">
                <span>
                  Estimated:{" "}
                  {formatEstimatedCostLabel(selectedActivity.estimatedCost)}
                </span>
                <button
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
                  onClick={() => openActivityMaps(selectedActivity)}
                  type="button"
                >
                  Open Maps
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      <div className="absolute bottom-3 right-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
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
