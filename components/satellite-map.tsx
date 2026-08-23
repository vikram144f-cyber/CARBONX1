"use client";

/**
 * SatelliteMap — reusable Leaflet-based satellite map component.
 *
 * Uses Esri World Imagery (publicly accessible satellite tiles)
 * with official attribution preserved.
 *
 * DATA HONESTY LABELS:
 *  - Project boundaries:  Real registry GeoJSON
 *  - FIRMS points:        Real NASA FIRMS thermal anomaly points (OBSERVED)
 *  - Buffered zones:      CARBONX-derived from FIRMS buffer (ESTIMATED)
 *  - Intersections:       CARBONX calculated overlap polygon (CALCULATED)
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
  /** [lng, lat] centroid */
  centroid: [number, number];
  /** Optional: zoom level */
  zoom?: number;
  /** Optional: project boundary GeoJSON */
  boundary?: GeoJsonFeature | null;
  /** Optional: real NASA FIRMS hotspot points */
  firmsPoints?: FirmsPoint[];
  /** Optional: CARBONX-derived buffered impact zones (ESTIMATED) */
  bufferPolygons?: GeoJsonFeature[];
  /** Optional: genuine intersection polygons (CALCULATED) */
  intersections?: GeoJsonFeature[];
  /** Optional: incident location markers */
  incidentMarkers?: IncidentMarker[];
  /** Container height (CSS string) */
  height?: string;
  /** Optional extra CSS class */
  className?: string;
};

const ESRI_SATELLITE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN";

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
    incidents: import("leaflet").LayerGroup | null;
  }>({
    boundary: null,
    firms: null,
    estimated: null,
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

  // Bootstrap Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let L: typeof import("leaflet");

    const initMap = async () => {
      try {
        L = await import("leaflet");

        // Safe prototype clean
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapContainerRef.current!, {
          center: [centroid[1], centroid[0]],
          zoom,
          zoomControl: false,
          attributionControl: true,
        });

        // Add custom minimal zoom control in top right
        L.control.zoom({ position: "topright" }).addTo(map);

        L.tileLayer(ESRI_SATELLITE_URL, {
          attribution: ESRI_ATTRIBUTION,
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error("[SatelliteMap] init failed", err);
        setError("Geospatial map failed to initialize.");
      }
    };

    void initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update overlays
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
              color: "#ED8E59",
              weight: 2,
              opacity: 0.95,
              fillOpacity: 0.06,
              fillColor: "#ED8E59",
            },
          }).bindTooltip("Project Boundary · Registry Provenance", {
            sticky: true,
          });
          lr.boundary = layer;
          if (layers.boundary) layer.addTo(map);
        } catch {
          // non-fatal
        }
      }

      // --- FIRMS points ---
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
            radius: 6,
            color: "#E56B78",
            fillColor: "#E56B78",
            fillOpacity: 0.85,
            weight: 1.5,
          }).bindTooltip(
            [
              `<div style="font-family:ui-monospace,monospace;font-size:10px;">`,
              `<strong style="color:#ED8E59;">NASA FIRMS ANOMALY</strong> [OBSERVED]`,
              `<div>Sensor: ${pt.sourceName ?? "FIRMS"} ${pt.sourceInstrument ?? ""}</div>`,
              `<div>Time: ${pt.observedAt ? new Date(pt.observedAt).toISOString().replace("T", " ").slice(0, 19) : "n/a"} UTC</div>`,
              `<div>Confidence: ${conf}</div>`,
              `<div style="color:#E56B78;margin-top:2px;">*Point detection — not exact burned perimeter</div>`,
              `</div>`,
            ].join(""),
            { permanent: false },
          );
          group.addLayer(marker);
        }
        lr.firms = group;
        if (layers.firms) group.addTo(map);
      }

      // --- Buffered ESTIMATED zones + overlaps ---
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
                color: "#ED8E59",
                weight: 1.5,
                dashArray: "4 4",
                fillOpacity: 0.12,
                fillColor: "#ED8E59",
              },
            })
              .bindTooltip("Buffered Impact Zone [ESTIMATED]", { sticky: true })
              .addTo(group);
          } catch {
            // non-fatal
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
                color: "#E8BCCB",
                weight: 2,
                fillOpacity: 0.25,
                fillColor: "#E8BCCB",
              },
            })
              .bindTooltip("Boundary Overlap [CALCULATED]", { sticky: true })
              .addTo(group);
          } catch {
            // non-fatal
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
              ? "#E56B78"
              : inc.risk === "HIGH"
                ? "#ED8E59"
                : "#72B084";
          L.circleMarker([inc.latitude, inc.longitude], {
            radius: 8,
            color,
            fillColor: color,
            fillOpacity: 0.4,
            weight: 2,
          })
            .bindTooltip(
              `<div style="font-family:ui-monospace,monospace;font-size:10px;">Incident ${inc.id.slice(0, 8)} · ${inc.status} · Risk: ${inc.risk ?? "UNASSESSED"}</div>`,
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

  const toggleLayer = async (key: keyof LayerVisibility) => {
    if (!mapRef.current || !mapReady) return;
    const map = mapRef.current;
    const lr = layersRef.current;

    const newVal = !layers[key];
    setLayers((prev) => ({ ...prev, [key]: newVal }));

    const layerMap = {
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
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded border border-[var(--cx-border)] bg-[var(--cx-surface-inset)] p-6 text-center text-xs text-[var(--cx-text-muted)]"
        style={{ height }}
      >
        <div>
          <p>{error}</p>
          <p className="cx-mono mt-1 text-[11px]">
            Centroid: {centroid[1].toFixed(4)}°N, {centroid[0].toFixed(4)}°E
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded border border-[var(--cx-border)] ${className}`}
      style={{ height }}
    >
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { background: #121025; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(18,16,37,0.85) !important; color: #8E7E91 !important; border-top-left-radius: 4px; padding: 2px 6px !important; }
        .leaflet-control-attribution a { color: #ED8E59 !important; text-decoration: none; }
        .leaflet-tooltip { background: #1E1B38; color: #FFF4ED; border: 1px solid rgba(232,188,203,0.2); border-radius: 4px; font-size: 11px; padding: 6px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .leaflet-bar { border: 1px solid rgba(232,188,203,0.15) !important; border-radius: 4px !important; overflow: hidden; box-shadow: none !important; }
        .leaflet-bar a { background: #1E1B38 !important; color: #FFF4ED !important; border-bottom: 1px solid rgba(232,188,203,0.15) !important; width: 26px !important; height: 26px !important; line-height: 26px !important; font-size: 13px !important; }
        .leaflet-bar a:hover { background: #281B34 !important; color: #ED8E59 !important; }
      `}</style>

      {/* Map surface */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Top-right Fit button */}
      <div className="absolute right-3 top-16 z-[1000]">
        <button
          type="button"
          onClick={() => void fitToBounds()}
          title="Fit view to boundary & events"
          className="cx-mono rounded border border-[var(--cx-border)] bg-[rgba(30,27,56,0.92)] px-2 py-1 text-[10px] font-semibold tracking-wider text-[var(--cx-text)] backdrop-blur transition hover:border-[var(--cx-accent)] hover:text-[var(--cx-accent)]"
        >
          FIT
        </button>
      </div>

      {/* Bottom-left minimal layer bar */}
      <div className="absolute bottom-6 left-3 z-[1000] flex flex-wrap items-center gap-2 rounded border border-[var(--cx-border)] bg-[rgba(18,16,37,0.9)] px-3 py-1.5 backdrop-blur">
        <span className="cx-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--cx-text-muted)] mr-1">
          LAYERS
        </span>
        {(
          [
            { key: "boundary", label: "Boundary", color: "#ED8E59" },
            { key: "firms", label: "FIRMS", color: "#E56B78" },
            { key: "estimated", label: "Estimated", color: "#ED8E59" },
            { key: "incidents", label: "Incidents", color: "#72B084" },
          ] as const
        ).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => void toggleLayer(key)}
            className={`cx-mono flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] transition ${
              layers[key]
                ? "bg-[rgba(232,188,203,0.08)] text-[var(--cx-text)]"
                : "opacity-40 text-[var(--cx-text-muted)]"
            }`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
