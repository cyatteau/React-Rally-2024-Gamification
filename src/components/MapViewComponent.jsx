import React, { useEffect, useRef } from "react";
import MapView from "@arcgis/core/views/MapView";
import Map from "@arcgis/core/Map";
import Basemap from "@arcgis/core/Basemap";
import VectorTileLayer from "@arcgis/core/layers/VectorTileLayer"; // Import VectorTileLayer for custom basemap
import Graphic from "@arcgis/core/Graphic";
import Circle from "@arcgis/core/geometry/Circle";
import esriConfig from "@arcgis/core/config";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import { useAppContext } from "../AppContext";

const MapViewComponent = ({ location, landmarks, selectedBasemap }) => {
  const { state } = useAppContext();
  const mapDiv = useRef(null);
  esriConfig.apiKey = "yourkey"

  // Utility function to calculate distance between two lat/lon coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth's radius in kilometers
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  };

  useEffect(() => {
    if (!location || !mapDiv.current) return;

    const customBasemapLayer = new VectorTileLayer({
      portalItem: {
        id: selectedBasemap,
      },
    });

    const basemap = new Basemap({
      baseLayers: [customBasemapLayer],
    });

    const map = new Map({
      basemap: basemap,
    });

    const view = new MapView({
      container: mapDiv.current,
      map: map,
      center: [location.longitude, location.latitude],
      zoom: 13,
    });

    // Add a red marker at the user's current location
    const userMarker = new Graphic({
      geometry: {
        type: "point",
        longitude: location.longitude,
        latitude: location.latitude,
      },
      symbol: {
        type: "simple-marker",
        color: "red",
        size: "12px",
      },
    });

    // Draw a 1-mile radius circle around the user's location
    const radiusCircle = new Circle({
      center: [location.longitude, location.latitude],
      radius: 1609.34, // 1 mile in meters
      geodesic: true,
    });

    const circleSymbol = new SimpleFillSymbol({
      color: [51, 51, 204, 0.15],
      outline: {
        color: [51, 51, 204, 0.5],
        width: 2,
      },
    });

    const circleGraphic = new Graphic({
      geometry: radiusCircle,
      symbol: circleSymbol,
    });

    view.graphics.addMany([userMarker, circleGraphic]);

    // Check if there are any landmarks within the 1-mile radius
    const anyLandmarkWithinRadius = landmarks.some((landmark) => {
      const distance = calculateDistance(
        location.latitude,
        location.longitude,
        landmark.coordinates.latitude,
        landmark.coordinates.longitude
      );
      return distance <= 1.60934; // 1 mile in kilometers
    });

    const addLandmarkMarkers = () => {
      landmarks.forEach((landmark) => {
        const landmarkMarker = new Graphic({
          geometry: {
            type: "point",
            longitude: landmark.coordinates.longitude,
            latitude: landmark.coordinates.latitude,
          },
          symbol: new SimpleMarkerSymbol({
            color: "blue",
            size: "12px",
          }),
          popupTemplate: new PopupTemplate({
            title: landmark.name,
            content: `
              <p><b>Address:</b> ${landmark.address}</p>
              <p><b>Description:</b> ${landmark.description}</p>
            `,
          }),
        });
        view.graphics.add(landmarkMarker);
      });
    };

    if (anyLandmarkWithinRadius) {
      addLandmarkMarkers();
    }

    view.on("click", (event) => {
      view.hitTest(event).then((response) => {
        const graphic = response.results[0]?.graphic;
        if (graphic?.popupTemplate) {
          view.popup.open({
            location: graphic.geometry,
            features: [graphic],
          });
        }
      });
    });
    return () => view.destroy();
  }, [location, landmarks, selectedBasemap]);

  return <div ref={mapDiv} style={{ height: "63vh", width: "100%" }} />;
};

export default MapViewComponent;
