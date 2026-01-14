/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { darkMapStyle } from "./map-dark-style";
import { CSSProperties, useMemo } from "react";

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

const MapComponent = ({ day }: { day: any }) => {
  const mapCenter = useMemo(() => {
    if (day?.activities && day.activities.length > 0) {
      return {
        lat: day.activities[0].latitude,
        lng: day.activities[0].longitude,
      };
    }
    return { lat: 0, lng: 0 };
  }, [day]);
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAP_API as string,
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
        {day?.activities.map((activity: any) => (
          <Marker
            key={activity.id}
            position={{ lat: activity.latitude, lng: activity.longitude }}
            title={activity.placeName}
          />
        ))}
      </GoogleMap>
    </div>
  );
};

export { MapComponent };
