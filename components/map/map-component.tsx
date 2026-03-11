"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { darkMapStyle } from "./map-dark-style";
import { CSSProperties, useMemo } from "react";
import { DayWithActivities } from "@/lib/types";
import { Activity } from "@prisma/client";

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

const MapComponent = ({ day }: { day: DayWithActivities }) => {
  const mapCenter = useMemo(() => {
    const firstActivity = day?.activities?.[0];

    if (firstActivity?.latitude != null && firstActivity?.longitude != null) {
      return {
        lat: firstActivity.latitude,
        lng: firstActivity.longitude,
      };
    }
    return { lat: 0, lng: 0 };
  }, [day]);

  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.GOOGLE_MAP_API as string,
    version: "weekly",
  });

  if (!isLoaded) return <div>Loading...</div>;

  return (
    <div className="w-full h-full">
      <GoogleMap
        mapContainerStyle={defaultMapContainerStyle}
        center={mapCenter}
        zoom={13}
        options={defaultMapOptions}
      >
        {day?.activities.map((activity: Activity) => {
          if (activity.latitude == null || activity.longitude == null)
            return null;
          return (
            <Marker
              key={activity.id}
              position={{ lat: activity.latitude, lng: activity.longitude }}
              title={activity.placeName ?? activity.title}
            />
          );
        })}
      </GoogleMap>
    </div>
  );
};

export { MapComponent };
