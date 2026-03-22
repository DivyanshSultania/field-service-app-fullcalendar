import React, { useEffect, useRef, useState } from "react";
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from "../utils/googleMaps";

export default function TaskMapInline({
  assignedLocation,
  startLocation,
  stopLocation,
  radiusMeters
}) {
  const mapRef = useRef(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function initMap() {
      try {
        if (!assignedLocation?.lat || !assignedLocation?.lng) {
          setMapError("Assigned location coordinates are missing.");
          return;
        }

        await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);
        if (cancelled || !mapRef.current) return;

        const maps = window.google.maps;
        const center = {
          lat: Number(assignedLocation.lat),
          lng: Number(assignedLocation.lng)
        };

        const map = new maps.Map(mapRef.current, {
          center,
          zoom: 6
        });

        const isSameLocation =
          startLocation?.lat === stopLocation?.lat &&
          startLocation?.lng === stopLocation?.lng;
        const offset = 0.00005;

        const startLat = Number(startLocation?.lat);
        const startLng = Number(startLocation?.lng);
        const stopLat = isSameLocation ? startLat + offset : Number(stopLocation?.lat);
        const stopLng = isSameLocation ? startLng + offset : Number(stopLocation?.lng);

        const infoWindow = new maps.InfoWindow();

        if (startLat && startLng) {
          const startMarker = new maps.Marker({
            position: { lat: startLat, lng: startLng },
            map,
            title: "Start",
            label: "A",
            animation: maps.Animation.DROP
          });
          startMarker.addListener("click", () => {
            infoWindow.close();
            infoWindow.setContent(startMarker.getTitle());
            infoWindow.open(startMarker.getMap(), startMarker);
          });
        }

        if (stopLat && stopLng) {
          const endMarker = new maps.Marker({
            position: { lat: stopLat, lng: stopLng },
            map,
            title: "End",
            label: "B",
            animation: maps.Animation.DROP
          });
          endMarker.addListener("click", () => {
            infoWindow.close();
            infoWindow.setContent(endMarker.getTitle());
            infoWindow.open(endMarker.getMap(), endMarker);
          });
        }

        if (radiusMeters) {
          new maps.Circle({
            map,
            center,
            radius: Number(radiusMeters),
            fillColor: "#2563eb",
            fillOpacity: 0.15,
            strokeColor: "#2563eb",
            strokeOpacity: 0.8,
            strokeWeight: 2
          });
        }

        const bounds = new maps.LatLngBounds();
        bounds.extend(center);
        if (startLocation?.lat && startLocation?.lng) {
          bounds.extend({ lat: Number(startLocation.lat), lng: Number(startLocation.lng) });
        }
        if (stopLocation?.lat && stopLocation?.lng) {
          bounds.extend({ lat: Number(stopLocation.lat), lng: Number(stopLocation.lng) });
        }
        map.fitBounds(bounds);
      } catch (error) {
        console.error("Failed to render inline map", error);
        if (!cancelled) setMapError("Unable to load map.");
      }
    }

    setMapError("");
    initMap();
    return () => {
      cancelled = true;
    };
  }, [assignedLocation, startLocation, stopLocation, radiusMeters]);

  if (mapError) {
    return <div style={{ padding: 12, color: "#b91c1c" }}>{mapError}</div>;
  }

  return (
    <div
      ref={mapRef}
      style={{
        width: "100%",
        height: "420px",
        borderRadius: 8,
        border: "1px solid #e5e7eb"
      }}
    />
  );
}
