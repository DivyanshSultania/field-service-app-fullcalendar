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
        zoom: 6
      });

      mapInstanceRef.current = map;

      window.homemaidMap  = map;

    const isSameLocation =
        startLocation?.lat === stopLocation?.lat &&
        startLocation?.lng === stopLocation?.lng;

    const offset = 0.00005; // small shift (~5m)

    const startLat = Number(startLocation?.lat);
    const startLng = Number(startLocation?.lng);

    const stopLat = isSameLocation
        ? startLat + offset
        : Number(stopLocation?.lat);

    const stopLng = isSameLocation
        ? startLng + offset
        : Number(stopLocation?.lng);

    // Create an info window to share between markers.
    const infoWindow = new google.maps.InfoWindow();

    if (startLat && startLng) {
        // Start marker
       const startMarker = new maps.Marker({
            position: { lat: startLat, lng: startLng },
            map,
            title: "Start",
            label: "A",
            animation: maps.Animation.DROP,
            // icon: greenPinTarget
        });

        startMarker.addListener("click", () => {
            infoWindow.close();
            infoWindow.setContent(startMarker.getTitle());
            infoWindow.open(startMarker.getMap(), startMarker);
          });
    }
    

    if (stopLat && stopLng) {
        // Stop marker
        const ednMarker = new maps.Marker({
            position: { lat: stopLat, lng: stopLng },
            map,
            title: "End",
            label: "B",
            animation: maps.Animation.DROP,
            // icon: redTargetIcon
        });

        ednMarker.addListener("click", () => {
            infoWindow.close();
            infoWindow.setContent(ednMarker.getTitle());
            infoWindow.open(ednMarker.getMap(), ednMarker);
          });

        
    }

    
    

    //   // 🔵 Assigned Location Marker
    //   new maps.Marker({
    //     position: center,
    //     map,
    //     title: "Assigned Location",
    //     icon: {
    //       path: maps.SymbolPath.CIRCLE,
    //       scale: 8,
    //       fillColor: "#2563eb",
    //       fillOpacity: 1,
    //       strokeWeight: 2,
    //       strokeColor: "#ffffff"
    //     }
    //   });

    //   // 🟢 Start Location Marker
    //   if (startLocation?.lat && startLocation?.lng) {
    //     new maps.Marker({
    //       position: {
    //         lat: Number(startLocation.lat),
    //         lng: Number(startLocation.lng)
    //       },
    //       map,
    //       title: "Task Started Here",
    //       icon: {
    //         path: maps.SymbolPath.Marker,
    //         scale: 8,
    //         fillColor: "#16a34a",
    //         fillOpacity: 1,
    //         strokeWeight: 2,
    //         strokeColor: "#ffffff"
    //       }
    //     });
    //   }

    //   // 🔴 Stop Location Marker
    //   if (stopLocation?.lat && stopLocation?.lng) {
    //     new maps.Marker({
    //       position: {
    //         lat: Number(stopLocation.lat),
    //         lng: Number(stopLocation.lng)
    //       },
    //       map,
    //       title: "Task Stopped Here",
    //       icon: {
    //         path: maps.SymbolPath.Marker,
    //         scale: 8,
    //         fillColor: "#dc2626",
    //         fillOpacity: 1,
    //         strokeWeight: 2,
    //         strokeColor: "#ffffff"
    //       }
    //     });
    //   }

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