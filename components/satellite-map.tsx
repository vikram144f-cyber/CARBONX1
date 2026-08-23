"use client";

/**
 * SatelliteMap — reusable Leaflet-based satellite map component.
 *
 * Uses the Esri World Imagery tile service (publicly accessible, no API key)
 * with correct ESRI attribution preserved at all times.
 *
 * DATA HONESTY LABELS:
 *  - Project boundaries:  real source GeoJSON, labelled with provenance
 *  - FIRMS points:        real NASA FIRMS thermal anomaly points (OBSERVED)
 *  - Buffered zones:      CARBONX-derived from FIRMS buffer — labelled ESTIMATED
 *  - Intersections:       CARBONX-derived overlap polygon — labelled CARBONX CALCULATED
 *  - Centroids:           project centroid from registry data
 *
 * No imagery timestamps are invented. No satellite observations are fabricated.
 */

import { useEffect, useRef, useState } from "react";

export type FirmsPoint = {
  id: string;
  longitude: number;
  latitude: number;
  sourceConfidence: number | null;
  observedAt: string | null;
  sourceInstrument: string | null;
  sourceName?: string;
};

export type GeoJsonFeature = {
  type: string;
  geometry?: unknown;
  coordinates?: unknown;
  properties?: Record<string, unknown> | null;
};

export type IncidentMarker = {
  id: string;
  longitude: number;
  latitude: number;
  status: string;
  risk: string | null;
};

export type SatelliteMapProps = {
  /** [lng, lat] centroid — required to derive initial view */
  centroid: [number, number];
  /** Optional: zoom level */
  zoom?: number;
  /** Optional: project boundary GeoJSON (Polygon/MultiPolygon or Feature) */
  boundary?: GeoJsonFeature | null;
  /** Optional: real NASA FIRMS hotspot points */
  firmsPoints?: FirmsPoint[];
  /** Optional: CARBONX-derived buffered impact zones (ESTIMATED) */
  bufferPolygons?: GeoJsonFeature[];
  /** Optional: genuine intersection polygons (CARBONX CALCULATED) */
  intersections?: GeoJsonFeature[];
  /** Optional: incident location markers */
  incidentMarkers?: IncidentMarker[];
  /** Container height (CSS string) */
  height?: string;
  /** Optional extra CSS class */
  className?: string;
};

// Esri World Imagery tile URL — publicly accessible, no API key required.
const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

type LayerVisibility = {
  boundary: boolean;
  firms: boolean;
  estimated: boolean;
  incidents: boolean;
};

export function SatelliteMap({
  centroid,
  zoom = 10,
  boundary,
  firmsPoints = [],
  bufferPolygons = [],
  intersections = [],
  incidentMarkers = [],
  height = "420px",
  className = "",
}: SatelliteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layersRef = useRef<{
    boundary: import("leaflet").Layer | null;
    firms: import("leaflet").LayerGroup | null;
    estimated: import("leaflet").LayerGroup | null;
    intersections: import("leaflet").LayerGroup | null;
    incidents: import("leaflet").LayerGroup | null;
  }>({
    boundary: null,
    firms: null,
    estimated: null,
    intersections: null,
    incidents: null,
  });

  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({
    boundary: true,
    firms: true,
    estimated: true,
    incidents: true,
  });
  const [mapReady, setMapReady] = useState(false);

  // Bootstrap Leaflet — runs once client-side only
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let L: typeof import("leaflet");

    const initMap = async () => {
      try {
        L = await import("leaflet");

        // Fix Leaflet default icon paths in Next.js
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapContainerRef.current!, {
          center: [centroid[1], centroid[0]],
          zoom,
          zoomControl: true,
          attributionControl: true,
        });

        // Satellite basemap — Esri World Imagery, attribution preserved
        L.tileLayer(ESRI_SATELLITE_URL, {
          attribution: ESRI_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("[SatelliteMap] init failed", err);
        setError("Map could not be initialised. A 2D summary is available below.");
      }
    };

    void initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update overlays whenever data or visibility changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const run = async () => {
      const L = await import("leaflet");
      const map = mapRef.current!;
      const lr = layersRef.current;

      // --- Boundary ---
      if (lr.boundary) {
        map.removeLayer(lr.boundary);
        lr.boundary = null;
      }
      if (boundary) {
        const geom =
          (boundary as { type: string }).type === "Feature"
            ? (boundary as { geometry: unknown }).geometry
            : boundary;
        try {
          const layer = L.geoJSON(geom as Parameters<typeof L.geoJSON>[0], {
            style: {
              color: "#ed8e59",
              weight: 2.5,
              opacity: 0.9,
              fillOpacity: 0.08,
              fillColor: "#ed8e59",
            },
          }).bindTooltip("Project boundary · Source: registry GeoJSON", {
            sticky: true,
          });
          lr.boundary = layer;
          if (layers.boundary) layer.addTo(map);
        } catch {
          // Non-fatal; continue
        }
      }

      // --- FIRMS hotspot points ---
      if (lr.firms) {
        map.removeLayer(lr.firms);
        lr.firms = null;
      }
      if (firmsPoints.length > 0) {
        const group = L.layerGroup();
        for (const pt of firmsPoints) {
          const conf =
            pt.sourceConfidence !== null
              ? `${(pt.sourceConfidence * 100).toFixed(0)}%`
              : "n/a";
          const marker = L.circleMarker([pt.latitude, pt.longitude], {
            radius: 7,
            color: "#e56b78",
            fillColor: "#e56b78",
            fillOpacity: 0.75,
            weight: 1.5,
          }).bindTooltip(
            [
              `<strong>FIRMS thermal anomaly</strong>`,
              `Source: ${pt.sourceName ?? "NASA FIRMS"} ${pt.sourceInstrument ?? ""}`,
              `Observed: ${pt.observedAt ? new Date(pt.observedAt).toUTCString() : "unknown"}`,
              `Confidence: ${conf}`,
              `<em style="color:#e56b78">⚠ This is a point detection — NOT exact burned area</em>`,
            ].join("<br>"),
            { permanent: false },
          );
          group.addLayer(marker);
        }
        lr.firms = group;
        if (layers.firms) group.addTo(map);
      }

      // --- Buffered ESTIMATED zones ---
      if (lr.estimated) {
        map.removeLayer(lr.estimated);
        lr.estimated = null;
      }
      const allEstimated = [...bufferPolygons, ...intersections];
      if (allEstimated.length > 0) {
        const group = L.layerGroup();
        bufferPolygons.forEach((feat) => {
          const geom =
            (feat as { type: string }).type === "Feature"
              ? (feat as { geometry: unknown }).geometry
              : feat;
          try {
            L.geoJSON(geom as Parameters<typeof L.geoJSON>[0], {
              style: {
                color: "#ed8e59",
                weight: 1.5,
                dashArray: "6 4",
                fillOpacity: 0.14,
                fillColor: "#ed8e59",
              },
            })
              .bindTooltip(
                "ESTIMATED impact zone — buffered FIRMS point · CARBONX calculated",
                { sticky: true },
              )
              .addTo(group);
          } catch {
            // Non-fatal
          }
        });
        intersections.forEach((feat) => {
          const geom =
            (feat as { type: string }).type === "Feature"
              ? (feat as { geometry: unknown }).geometry
              : feat;
          try {
            L.geoJSON(geom as Parameters<typeof L.geoJSON>[0], {
              style: {
                color: "#e8bccb",
                weight: 2,
                fillOpacity: 0.22,
                fillColor: "#e8bccb",
              },
            })
              .bindTooltip(
                "CARBONX CALCULATED overlap — genuine boundary intersection",
                { sticky: true },
              )
              .addTo(group);
          } catch {
            // Non-fatal
          }
        });
        lr.estimated = group;
        if (layers.estimated) group.addTo(map);
      }

      // --- Incident markers ---
      if (lr.incidents) {
        map.removeLayer(lr.incidents);
        lr.incidents = null;
      }
      if (incidentMarkers.length > 0) {
        const group = L.layerGroup();
        for (const inc of incidentMarkers) {
          const color =
            inc.risk === "CRITICAL"
              ? "#e56b78"
              : inc.risk === "HIGH"
                ? "#ed8e59"
                : inc.risk === "MEDIUM"
                  ? "#c3a8dc"
                  : "#9fc6a8";
          L.circleMarker([inc.latitude, inc.longitude], {
            radius: 9,
            color,
            fillColor: color,
            fillOpacity: 0.4,
            weight: 2,
          })
            .bindTooltip(
              `Incident ${inc.id.slice(0, 8)} · ${inc.status} · risk: ${inc.risk ?? "UNASSESSED"}`,
              { permanent: false },
            )
            .addTo(group);
        }
        lr.incidents = group;
        if (layers.incidents) group.addTo(map);
      }
    };

    void run();
  }, [
    mapReady,
    boundary,
    firmsPoints,
    bufferPolygons,
    intersections,
    incidentMarkers,
    layers,
  ]);

  // Fit-to-bounds helper
  const fitToBounds = async () => {
    if (!mapRef.current) return;
    const L = await import("leaflet");
    const map = mapRef.current;
    const boundsPoints: [number, number][] = [];

    if (boundary) {
      try {
        const geom =
          (boundary as { type: string }).type === "Feature"
            ? (boundary as { geometry: unknown }).geometry
            : boundary;
        const layer = L.geoJSON(geom as Parameters<typeof L.geoJSON>[0]);
        const b = layer.getBounds();
        if (b.isValid()) {
          boundsPoints.push([b.getSouth(), b.getWest()]);
          boundsPoints.push([b.getNorth(), b.getEast()]);
        }
      } catch {
        // fall through
      }
    }

    firmsPoints.forEach((pt) =>
      boundsPoints.push([pt.latitude, pt.longitude]),
    );
    boundsPoints.push([centroid[1], centroid[0]]);

    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints as [number, number][], { padding: [30, 30] });
    }
  };

  // Toggle layer visibility
  const toggleLayer = async (key: keyof LayerVisibility) => {
    if (!mapRef.current || !mapReady) return;
    const L = await import("leaflet");
    const map = mapRef.current;
    const lr = layersRef.current;

    const newVal = !layers[key];
    setLayers((prev) => ({ ...prev, [key]: newVal }));

    const layerMap: Record<keyof LayerVisibility, import("leaflet").Layer | null> = {
      boundary: lr.boundary,
      firms: lr.firms,
      estimated: lr.estimated,
      incidents: lr.incidents,
    };
    const target = layerMap[key];
    if (!target) return;
    if (newVal) {
      map.addLayer(target);
    } else {
      map.removeLayer(target);
    }
    void L; // suppress unused import warning
  };

  if (error) {
    return (
      <div
        className="cx-panel flex items-center justify-center rounded-xl p-6 text-center"
        style={{ height }}
      >
        <div>
          <p className="text-sm text-cx-text-muted">{error}</p>
          <p className="mt-2 text-xs" style={{ color: "var(--cx-text-muted)" }}>
            Centroid: {centroid[1].toFixed(4)}, {centroid[0].toFixed(4)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ height }}>
      {/* Leaflet CSS — injected client-side */}
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { background: #1b1931; font-family: inherit; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(27,25,49,0.85) !important; color: #b7a5b7 !important; }
        .leaflet-control-attribution a { color: var(--cx-accent) !important; }
        .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: #1b1931; color: #fff4ed; border: 1px solid rgba(232,188,203,0.16); }
        .leaflet-tooltip { background: rgba(27,25,49,0.92); color: #fff4ed; border: 1px solid rgba(232,188,203,0.2); font-size: 11px; }
        .leaflet-bar a { background: #1b1931 !important; color: #fff4ed !important; border-color: rgba(232,188,203,0.2) !important; }
        .leaflet-bar a:hover { background: rgba(237,142,89,0.15) !important; }
      `}</style>

      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Controls overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Fit-to-bounds button */}
        <button
          type="button"
          onClick={() => void fitToBounds()}
          title="Fit to bounds"
          style={{
            background: "rgba(27,25,49,0.88)",
            border: "1px solid rgba(232,188,203,0.2)",
            borderRadius: 8,
            color: "#fff4ed",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.1em",
            padding: "5px 10px",
            textTransform: "uppercase",
          }}
        >
          Fit
        </button>
      </div>

      {/* Layer toggles + legend — bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: 28,
          left: 10,
          zIndex: 1000,
          background: "rgba(27,25,49,0.88)",
          border: "1px solid rgba(232,188,203,0.18)",
          borderRadius: 10,
          padding: "8px 12px",
          fontSize: 10,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          minWidth: 160,
        }}
      >
        <p
          style={{
            color: "var(--cx-accent)",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          Layers
        </p>
        {(
          [
            { key: "boundary", label: "Project boundary", color: "#ed8e59" },
            { key: "firms", label: "FIRMS hotspots", color: "#e56b78" },
            { key: "estimated", label: "ESTIMATED impact", color: "#c3a8dc" },
            { key: "incidents", label: "Incidents", color: "#9fc6a8" },
          ] as const
        ).map(({ key, label, color }) => (
          <label
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              cursor: "pointer",
              color: layers[key] ? "#fff4ed" : "rgba(255,244,237,0.4)",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: color,
                opacity: layers[key] ? 1 : 0.3,
                flexShrink: 0,
              }}
            />
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => void toggleLayer(key)}
              style={{ display: "none" }}
            />
            {label}
          </label>
        ))}

        {/* Data provenance legend */}
        <hr
          style={{
            border: "none",
            borderTop: "1px solid rgba(232,188,203,0.14)",
            margin: "4px 0",
          }}
        />
        <p style={{ color: "rgba(183,165,183,0.7)", lineHeight: 1.5 }}>
          <span style={{ color: "#ed8e59" }}>■</span> Real source GeoJSON
          <br />
          <span style={{ color: "#e56b78" }}>●</span> NASA FIRMS (OBSERVED)
          <br />
          <span style={{ color: "#c3a8dc" }}>■</span> CARBONX ESTIMATED
          <br />
          <span style={{ color: "#e8bccb" }}>■</span> CARBONX calculated overlap
        </p>
      </div>
    </div>
  );
}
