import React, { useEffect, useRef } from "react";
import Modal from "./Modal";
import { GOOGLE_MAPS_API_KEY, loadGoogleMapsApi } from "../utils/googleMaps";

export default function TaskMapModal({
  open,
  onClose,
  assignedLocation,
  startLocation,
  stopLocation,
  radiusMeters
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    async function initMap() {
      await loadGoogleMapsApi(GOOGLE_MAPS_API_KEY);

      const maps = window.google.maps;

      const center = {
        lat: Number(assignedLocation.lat),
        lng: Number(assignedLocation.lng)
      };

      const map = new maps.Map(mapRef.current, {
        center,
        zoom: 15
      });

      mapInstanceRef.current = map;

      // 🔵 Assigned Location Marker
      new maps.Marker({
        position: center,
        map,
        title: "Assigned Location",
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#2563eb",
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: "#ffffff"
        }
      });

      // 🟢 Start Location Marker
      if (startLocation?.lat && startLocation?.lng) {
        new maps.Marker({
          position: {
            lat: Number(startLocation.lat),
            lng: Number(startLocation.lng)
          },
          map,
          title: "Task Started Here",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#16a34a",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff"
          }
        });
      }

      // 🔴 Stop Location Marker
      if (stopLocation?.lat && stopLocation?.lng) {
        new maps.Marker({
          position: {
            lat: Number(stopLocation.lat),
            lng: Number(stopLocation.lng)
          },
          map,
          title: "Task Stopped Here",
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#dc2626",
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: "#ffffff"
          }
        });
      }

      // 🔵 Allowed Radius Circle
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

      // Auto fit bounds to include all markers
      const bounds = new maps.LatLngBounds();
      bounds.extend(center);

      if (startLocation?.lat && startLocation?.lng) {
        bounds.extend({
          lat: Number(startLocation.lat),
          lng: Number(startLocation.lng)
        });
      }

      if (stopLocation?.lat && stopLocation?.lng) {
        bounds.extend({
          lat: Number(stopLocation.lat),
          lng: Number(stopLocation.lng)
        });
      }

      map.fitBounds(bounds);
    }

    initMap();
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} title="Shift Map View" onClose={onClose}>
      <div
        ref={mapRef}
        style={{
          width: "800px",
          height: "500px",
          borderRadius: 8
        }}
      />
    </Modal>
  );
}