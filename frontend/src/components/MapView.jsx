import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";

const makeIcon = (label, variant, selected) => {
  const big = variant === "depot-marker" || variant === "end-marker";
  return L.divIcon({
    className: "",
    html: `<div class="stop-marker ${variant || ""} ${selected ? "marker-selected" : ""}">${label}</div>`,
    iconSize: big ? [34, 34] : [30, 30],
    iconAnchor: big ? [17, 17] : [15, 15],
  });
};

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 15, { animate: true });
    } else if (points.length > 1) {
      map.flyToBounds(L.latLngBounds(points).pad(0.15), { duration: 0.8 });
    }
  }, [points, map]);
  return null;
}

export const MapView = ({ stops, geometry, legs, start, end, selectedId, onSelect }) => {
  const center = useMemo(() => {
    if (start) return [start.lat, start.lon];
    if (stops.length) return [stops[0].lat, stops[0].lon];
    return [41.3688, 2.1236];
  }, [stops, start]);

  const fullLine = useMemo(() => (geometry || []).map((c) => [c[1], c[0]]), [geometry]);

  const legLines = useMemo(
    () => (legs || []).map((leg) => leg.map((c) => [c[1], c[0]])),
    [legs]
  );

  const { inLeg, outLeg } = useMemo(() => {
    if (!selectedId) return { inLeg: -1, outLeg: -1 };
    const i = stops.findIndex((s) => s.id === selectedId);
    if (i < 0) return { inLeg: -1, outLeg: -1 };
    const node = (start ? 1 : 0) + i;
    return { inLeg: node - 1, outLeg: node };
  }, [selectedId, stops, start]);

  const boundsPoints = useMemo(() => {
    const pts = [];
    if (start) pts.push([start.lat, start.lon]);
    if (end) pts.push([end.lat, end.lon]);
    stops.forEach((s) => pts.push([s.lat, s.lon]));
    fullLine.forEach((c) => pts.push(c));
    return pts;
  }, [stops, fullLine, start, end]);

  return (
    <div className="h-full w-full" data-testid="route-map">
      <MapContainer center={center} zoom={13} className="h-full w-full" zoomControl={true}>
        <TileLayer
          className="dark-tiles"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        {/* Base route: per-leg if available, else single line */}
        {legLines.length > 0 ? (
          <>
            {legLines.map((pos, idx) =>
              idx === inLeg || idx === outLeg ? null : (
                <Polyline key={idx} positions={pos} pathOptions={{ color: "#F26A21", weight: 4, opacity: 0.85 }} />
              )
            )}
            {inLeg >= 0 && legLines[inLeg] && (
              <Polyline positions={legLines[inLeg]} pathOptions={{ color: "#22C55E", weight: 7, opacity: 1 }} />
            )}
            {outLeg >= 0 && legLines[outLeg] && (
              <Polyline positions={legLines[outLeg]} pathOptions={{ color: "#EF4444", weight: 7, opacity: 1 }} />
            )}
          </>
        ) : (
          fullLine.length > 0 && (
            <Polyline positions={fullLine} pathOptions={{ color: "#F26A21", weight: 4, opacity: 0.9 }} />
          )
        )}

        {start && (
          <Marker position={[start.lat, start.lon]} icon={makeIcon(end ? "S" : "S/E", "depot-marker")}>
            <Popup><div style={{ fontFamily: "IBM Plex Sans" }}><strong>Almacén de salida</strong><div style={{ fontSize: 12, color: "#475569" }}>{start.address}</div></div></Popup>
          </Marker>
        )}
        {end && (
          <Marker position={[end.lat, end.lon]} icon={makeIcon("E", "end-marker")}>
            <Popup><div style={{ fontFamily: "IBM Plex Sans" }}><strong>Almacén de llegada</strong><div style={{ fontSize: 12, color: "#475569" }}>{end.address}</div></div></Popup>
          </Marker>
        )}

        {stops.map((s, i) => (
          <Marker
            key={s.id}
            position={[s.lat, s.lon]}
            icon={makeIcon(String(i + 1), s.pickup_only ? "pickup-marker" : null, s.id === selectedId)}
            eventHandlers={{ click: () => onSelect(s.id) }}
          >
            <Popup>
              <div style={{ fontFamily: "IBM Plex Sans" }}>
                <strong>{i + 1}. {s.name || "Parada"}</strong>
                <div style={{ fontSize: 12, color: "#475569" }}>{s.address}</div>
                {s.pickup_only && <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 700, marginTop: 2 }}>● Solo recogida</div>}
              </div>
            </Popup>
          </Marker>
        ))}

        <FitBounds points={boundsPoints} />
      </MapContainer>
    </div>
  );
};
