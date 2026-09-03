import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const makeIcon = (label, isDepot) =>
  L.divIcon({
    className: "",
    html: `<div class="stop-marker ${isDepot ? "depot-marker" : ""}">${label}</div>`,
    iconSize: isDepot ? [34, 34] : [30, 30],
    iconAnchor: isDepot ? [17, 17] : [15, 15],
  });

function FitBounds({ stops, geometry }) {
  const map = useMap();
  useEffect(() => {
    const pts = [];
    stops.forEach((s) => pts.push([s.lat, s.lon]));
    if (geometry && geometry.length) geometry.forEach((c) => pts.push([c[1], c[0]]));
    if (pts.length === 1) {
      map.setView(pts[0], 15, { animate: true });
    } else if (pts.length > 1) {
      map.flyToBounds(L.latLngBounds(pts).pad(0.15), { duration: 0.8 });
    }
  }, [stops, geometry, map]);
  return null;
}

export const MapView = ({ stops, geometry }) => {
  const center = useMemo(() => {
    if (stops.length) return [stops[0].lat, stops[0].lon];
    return [41.3688, 2.1236]; // L'Hospitalet de Llobregat
  }, [stops]);

  const line = useMemo(
    () => (geometry || []).map((c) => [c[1], c[0]]),
    [geometry]
  );

  return (
    <div className="h-full w-full" data-testid="route-map">
    <MapContainer
      center={center}
      zoom={13}
      className="h-full w-full"
      zoomControl={true}
    >
      <TileLayer
        className="dark-tiles"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap contributors'
      />
      {line.length > 0 && (
        <Polyline positions={line} pathOptions={{ color: "#FF6B00", weight: 4, opacity: 0.9 }} />
      )}
      {stops.map((s, i) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lon]}
          icon={makeIcon(i === 0 ? "D" : String(i), i === 0)}
        >
          <Popup>
            <div style={{ fontFamily: "IBM Plex Sans" }}>
              <strong>{i === 0 ? "Depósito · " : `#${i} · `}{s.name || "Parada"}</strong>
              <div style={{ fontSize: 12, color: "#475569" }}>{s.address}</div>
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds stops={stops} geometry={geometry} />
    </MapContainer>
    </div>
  );
};
