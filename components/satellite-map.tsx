"use client";

/**
 * SatelliteMap — Geospatial project and environmental evidence map
 *
 * Base Layer Options:
 * 1. Google satellite context tiles
 * 2. Esri World Imagery
 * 3. Google hybrid context tiles
 * 4. CartoDB Dark Spatial Telemetry
 * 5. OpenTopo Physical Relief
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
  brightness?: number;
};

export type ProjectMarkerItem = {
  id: string;
  name: string;
  centroidLng: number;
  centroidLat: number;
  countryCode?: string | null;
  registryId?: string | null;
  areaHa?: number | null;
  heldQuantity?: number;
  risk?: string | null;
};

export type GeoJsonFeature = {
  type: string;
  geometry?: unknown;
  coordinates?: unknown;
  geojson?: unknown;
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
  /** Optional: initial zoom level */
  zoom?: number;
  /** Optional: single project boundary GeoJSON or boundary record */
  boundary?: GeoJsonFeature | Record<string, unknown> | null;
  /** Optional: multi-project boundaries map by projectId */
  multiBoundaries?: Array<{ id: string; name: string; geojson: GeoJsonFeature }>;
  /** Optional: real NASA FIRMS hotspot points */
  firmsPoints?: FirmsPoint[];
  /** Optional: CARBONX-derived buffered impact zones (ESTIMATED) */
  bufferPolygons?: GeoJsonFeature[];
  /** Optional: genuine intersection polygons (CALCULATED) */
  intersections?: GeoJsonFeature[];
  /** Optional: incident location markers */
  incidentMarkers?: IncidentMarker[];
  /** Optional: project markers for global overview */
  projectMarkers?: ProjectMarkerItem[];
  /** Container height (CSS string) */
  height?: string;
  /** Optional extra CSS class */
  className?: string;
  /** Show interactive region quick-jumper pills */
  showQuickJump?: boolean;
};

type BaseTileLayer = "google" | "esri" | "sentinel" | "dark" | "topo";

const TILE_CONFIG: Record<
  BaseTileLayer,
  { name: string; url: string; attribution: string; maxZoom: number }
> = {
  google: {
    name: "Google High-Res Satellite",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google, Maxar Technologies, CNES / Airbus",
    maxZoom: 20,
  },
  esri: {
    name: "Esri World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri, Maxar, Earthstar Geographics, USDA, USGS",
    maxZoom: 19,
  },
  sentinel: {
    name: "Satellite context (not analysis)",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google satellite imagery",
    maxZoom: 19,
  },
  dark: {
    name: "CartoDB Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    maxZoom: 20,
  },
  topo: {
    name: "OpenTopo Physical Relief",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap",
    maxZoom: 17,
  },
};

const QUICK_REGIONS = [
  { id: "global", label: "Global Multi-Region", lng: 20.0, lat: 25.0, zoom: 3 },
  { id: "wayanad", label: "Wayanad (India)", lng: 76.132, lat: 11.685, zoom: 15 },
  { id: "sathyamangalam", label: "Sathyamangalam (India)", lng: 77.2455, lat: 11.4983, zoom: 14 },
  { id: "rotunda", label: "Rotunda (Romania)", lng: 22.7259, lat: 45.3504, zoom: 13 },
  { id: "albania", label: "ACAP (Albania)", lng: 19.4046, lat: 40.5348, zoom: 13 },
  { id: "amazon", label: "GreenForest (Brazil)", lng: -62.215, lat: -3.465, zoom: 13 },
];

function extractRawGeoJson(
  obj: unknown,
): Parameters<typeof import("leaflet")["geoJSON"]>[0] | null {
  if (!obj || typeof obj !== "object") return null;
  const raw = obj as Record<string, unknown>;

  // Case 1: Wrapped Prisma model with .geojson
  if (raw.geojson && typeof raw.geojson === "object") {
    return extractRawGeoJson(raw.geojson);
  }

  // Case 2: FeatureCollection
  if (raw.type === "FeatureCollection" && Array.isArray(raw.features)) {
    return raw as unknown as Parameters<
      typeof import("leaflet")["geoJSON"]
    >[0];
  }

  // Case 3: Single Feature
  if (raw.type === "Feature") {
    return raw as unknown as Parameters<
      typeof import("leaflet")["geoJSON"]
    >[0];
  }

  // Case 4: Raw Geometry (Polygon, MultiPolygon)
  if (
    raw.type === "Polygon" ||
    raw.type === "MultiPolygon" ||
    raw.type === "Point"
  ) {
    return {
      type: "Feature",
      properties: {},
      geometry: raw,
    } as unknown as Parameters<typeof import("leaflet")["geoJSON"]>[0];
  }

  return null;
}


export function SatelliteMap({
  centroid,
  zoom = 10,
  boundary,
  multiBoundaries = [],
  firmsPoints = [],
  bufferPolygons = [],
  intersections = [],
  incidentMarkers = [],
  projectMarkers = [],
  height = "480px",
  className = "",
  showQuickJump = false,
}: SatelliteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const baseTileRef = useRef<import("leaflet").TileLayer | null>(null);

  const [baseTile, setBaseTile] = useState<BaseTileLayer>("google");
  const [mapReady, setMapReady] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("global");
  const [layers, setLayers] = useState({
    boundary: true,
    firms: true,
    estimated: true,
    incidents: true,
    projects: true,
  });

  const layersRef = useRef<{
    boundary: import("leaflet").LayerGroup | null;
    firms: import("leaflet").LayerGroup | null;
    estimated: import("leaflet").LayerGroup | null;
    incidents: import("leaflet").LayerGroup | null;
    projects: import("leaflet").LayerGroup | null;
  }>({
    boundary: null,
    firms: null,
    estimated: null,
    incidents: null,
    projects: null,
  });

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let L: typeof import("leaflet");
    let cancelled = false;

    const initMap = async () => {
      try {
        L = await import("leaflet");
        if (cancelled || !mapContainerRef.current || mapRef.current) return;

        // Safe prototype cleanup
        delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(mapContainerRef.current, {
          center: [centroid[1], centroid[0]],
          zoom,
          zoomControl: false,
          attributionControl: true,
        });

        if (cancelled) {
          map.remove();
          return;
        }

        L.control.zoom({ position: "topright" }).addTo(map);

        const currentTile = TILE_CONFIG[baseTile];
        const tileLayer = L.tileLayer(currentTile.url, {
          attribution: currentTile.attribution,
          maxZoom: currentTile.maxZoom,
          subdomains: "abcd",
        }).addTo(map);

        baseTileRef.current = tileLayer;

        map.on("mousemove", (e) => {
          setCursorCoords({
            lat: parseFloat(e.latlng.lat.toFixed(4)),
            lng: parseFloat(e.latlng.lng.toFixed(4)),
          });
        });

        mapRef.current = map;
        setMapReady(true);

        // Multiple invalidation ticks to guarantee tiles fill the container
        setTimeout(() => map.invalidateSize(), 100);
        setTimeout(() => map.invalidateSize(), 300);
        setTimeout(() => map.invalidateSize(), 800);
      } catch (err) {
        console.error("[SatelliteMap] Init failed", err);
      }
    };

    void initMap();

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Base Tile Switch
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    import("leaflet").then((L) => {
      if (baseTileRef.current) {
        map.removeLayer(baseTileRef.current);
      }
      const conf = TILE_CONFIG[baseTile];
      const newTile = L.tileLayer(conf.url, {
        attribution: conf.attribution,
        maxZoom: conf.maxZoom,
        subdomains: "abcd",
      }).addTo(map);
      baseTileRef.current = newTile;
      map.invalidateSize();
    });
  }, [baseTile, mapReady]);

  // Centroid changes
  useEffect(() => {
    if (mapRef.current && mapReady && centroid) {
      mapRef.current.setView([centroid[1], centroid[0]], zoom);
      mapRef.current.invalidateSize();
    }
  }, [centroid, zoom, mapReady]);

  // Render Geospatial Overlays
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const renderLayers = async () => {
      const L = await import("leaflet");
      const map = mapRef.current!;
      const lr = layersRef.current;

      // ── 1. Boundary Polygons ───────────────────────────────────────
      if (lr.boundary) {
        map.removeLayer(lr.boundary);
        lr.boundary = null;
      }

      const boundaryGroup = L.layerGroup();
      const rawGeo = extractRawGeoJson(boundary);

      if (rawGeo) {
        try {
          const l = L.geoJSON(rawGeo, {
            style: {
              color: "#ED8E59",
              weight: 3,
              opacity: 0.95,
              fillOpacity: 0.16,
              fillColor: "#ED8E59",
            },
          }).bindTooltip("Registered Carbon Project Boundary Polygon", {
            sticky: true,
          });
          boundaryGroup.addLayer(l);

          const b = l.getBounds();
          if (b.isValid()) {
            map.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
          }
        } catch (e) {
          console.warn("[SatelliteMap] Boundary render notice", e);
        }
      }

      if (multiBoundaries.length > 0) {
        multiBoundaries.forEach((mb) => {
          const mbGeo = extractRawGeoJson(mb.geojson);
          if (mbGeo) {
            try {
              const l = L.geoJSON(mbGeo, {
                style: {
                  color: "#ED8E59",
                  weight: 2.5,
                  opacity: 0.9,
                  fillOpacity: 0.15,
                  fillColor: "#ED8E59",
                },
              }).bindTooltip(
                `<div class="cx-mono font-bold text-white">${mb.name}</div><div class="text-[10px] text-[#ED8E59]">Click to view project details</div>`,
                { sticky: true },
              );
              l.on("click", () => {
                window.location.href = `/projects/${mb.id}`;
              });
              boundaryGroup.addLayer(l);
            } catch {
              // non-fatal
            }
          }
        });
      }

      lr.boundary = boundaryGroup;
      if (layers.boundary) boundaryGroup.addTo(map);

      // ── 2. Project Markers for Global Studio ───────────────────────
      if (lr.projects) {
        map.removeLayer(lr.projects);
        lr.projects = null;
      }
      if (projectMarkers.length > 0) {
        const pGroup = L.layerGroup();
        projectMarkers.forEach((pm) => {
          const marker = L.circleMarker([pm.centroidLat, pm.centroidLng], {
            radius: 10,
            color: "#ED8E59",
            fillColor: "#1E1B38",
            fillOpacity: 0.95,
            weight: 2.5,
          }).bindPopup(
            [
              `<div style="font-family:ui-monospace,monospace;min-width:190px;padding:2px;">`,
              `<div style="font-weight:bold;color:#FFF;font-size:13px;margin-bottom:4px;">${pm.name}</div>`,
              `<div style="color:#ED8E59;font-size:10px;">${pm.countryCode ?? "—"} · ${pm.registryId ?? "VCS"}</div>`,
              `<div style="color:#FFF4ED;font-size:11px;margin-top:6px;">Holding: ${(pm.heldQuantity ?? 0).toLocaleString()} Credits</div>`,
              `<div style="margin-top:8px;display:flex;gap:6px;">`,
              `<a href="/projects/${pm.id}" style="color:#ED8E59;font-weight:bold;font-size:10px;text-decoration:none;border:1px solid #ED8E59;padding:3px 6px;border-radius:4px;">SPATIAL VIEW →</a>`,
              `<a href="/projects/${pm.id}/results" style="color:#72B084;font-weight:bold;font-size:10px;text-decoration:none;border:1px solid #72B084;padding:3px 6px;border-radius:4px;">TRUTH SCORE</a>`,
              `</div>`,
              `</div>`,
            ].join(""),
          );
          pGroup.addLayer(marker);
        });
        lr.projects = pGroup;
        if (layers.projects) pGroup.addTo(map);
      }

      // ── 3. NASA FIRMS Thermal Anomalies ────────────────────────────
      if (lr.firms) {
        map.removeLayer(lr.firms);
        lr.firms = null;
      }
      if (firmsPoints.length > 0) {
        const fGroup = L.layerGroup();
        firmsPoints.forEach((pt) => {
          const conf =
            pt.sourceConfidence !== null
              ? `${(pt.sourceConfidence * 100).toFixed(0)}%`
              : "n/a";
          const marker = L.circleMarker([pt.latitude, pt.longitude], {
            radius: 7,
            color: "#E56B78",
            fillColor: "#E56B78",
            fillOpacity: 0.9,
            weight: 1.5,
          }).bindTooltip(
            [
              `<div style="font-family:ui-monospace,monospace;font-size:10px;">`,
              `<strong style="color:#ED8E59;">NASA FIRMS ANOMALY</strong> [OBSERVED]`,
              `<div>Sensor: ${pt.sourceName ?? "FIRMS"} (${pt.sourceInstrument ?? "VIIRS"})</div>`,
              `<div>Time: ${pt.observedAt ? new Date(pt.observedAt).toISOString().replace("T", " ").slice(0, 19) : "n/a"} UTC</div>`,
              `<div>Confidence: ${conf}</div>`,
              `<div style="color:#E56B78;margin-top:2px;">*Point detection — not measured ground perimeter</div>`,
              `</div>`,
            ].join(""),
          );
          fGroup.addLayer(marker);
        });
        lr.firms = fGroup;
        if (layers.firms) fGroup.addTo(map);
      }

      // ── 4. Impact Buffers & Overlaps ──────────────────────────────
      if (lr.estimated) {
        map.removeLayer(lr.estimated);
        lr.estimated = null;
      }
      const estGroup = L.layerGroup();
      bufferPolygons.forEach((feat) => {
        const raw = extractRawGeoJson(feat);
        if (raw) {
          try {
            L.geoJSON(raw, {
              style: {
                color: "#ED8E59",
                weight: 1.5,
                dashArray: "4 4",
                fillOpacity: 0.12,
                fillColor: "#ED8E59",
              },
            })
              .bindTooltip("Buffered Impact Perimeter [ESTIMATED]", { sticky: true })
              .addTo(estGroup);
          } catch {
            // non-fatal
          }
        }
      });
      intersections.forEach((feat) => {
        const raw = extractRawGeoJson(feat);
        if (raw) {
          try {
            L.geoJSON(raw, {
              style: {
                color: "#E8BCCB",
                weight: 2,
                fillOpacity: 0.25,
                fillColor: "#E8BCCB",
              },
            })
              .bindTooltip("Boundary Overlap [CALCULATED]", { sticky: true })
              .addTo(estGroup);
          } catch {
            // non-fatal
          }
        }
      });
      lr.estimated = estGroup;
      if (layers.estimated) estGroup.addTo(map);

      // ── 5. Incidents ──────────────────────────────────────────────
      if (lr.incidents) {
        map.removeLayer(lr.incidents);
        lr.incidents = null;
      }
      if (incidentMarkers.length > 0) {
        const incGroup = L.layerGroup();
        incidentMarkers.forEach((inc) => {
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
            )
            .addTo(incGroup);
        });
        lr.incidents = incGroup;
        if (layers.incidents) incGroup.addTo(map);
      }
    };

    void renderLayers();
  }, [
    mapReady,
    boundary,
    multiBoundaries,
    projectMarkers,
    firmsPoints,
    bufferPolygons,
    intersections,
    incidentMarkers,
    layers,
  ]);

  const jumpToRegion = (region: (typeof QUICK_REGIONS)[0]) => {
    setSelectedRegion(region.id);
    if (!mapRef.current) return;
    mapRef.current.flyTo([region.lat, region.lng], region.zoom, {
      duration: 1.5,
      easeLinearity: 0.25,
    });
  };

  const toggleLayer = (key: keyof typeof layers) => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const lr = layersRef.current;
    const newVal = !layers[key];
    setLayers((prev) => ({ ...prev, [key]: newVal }));

    const target = lr[key as keyof typeof lr];
    if (!target) return;
    if (newVal) map.addLayer(target);
    else map.removeLayer(target);
  };

  return (
    <div
      className={`relative overflow-hidden rounded border border-[var(--cx-border)] ${className}`}
      style={{ height }}
    >
      <style>{`
        @import url("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
        .leaflet-container { background: #121025; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(18,16,37,0.88) !important; color: #8E7E91 !important; border-top-left-radius: 4px; padding: 2px 6px !important; }
        .leaflet-control-attribution a { color: #ED8E59 !important; text-decoration: none; }
        .leaflet-popup-content-wrapper { background: #1E1B38; color: #FFF4ED; border: 1px solid rgba(237,142,89,0.35); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }
        .leaflet-popup-tip { background: #1E1B38; }
        .leaflet-tooltip { background: #1E1B38; color: #FFF4ED; border: 1px solid rgba(232,188,203,0.25); border-radius: 4px; font-size: 11px; padding: 6px 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        .leaflet-bar { border: 1px solid rgba(232,188,203,0.15) !important; border-radius: 4px !important; overflow: hidden; box-shadow: none !important; }
        .leaflet-bar a { background: #1E1B38 !important; color: #FFF4ED !important; border-bottom: 1px solid rgba(232,188,203,0.15) !important; width: 28px !important; height: 28px !important; line-height: 28px !important; font-size: 14px !important; }
        .leaflet-bar a:hover { background: #281B34 !important; color: #ED8E59 !important; }
      `}</style>

      {/* Surface Canvas */}
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />

      {/* Top Quick-Jump Region Navigation Bar */}
      {showQuickJump && (
        <div className="absolute left-3 top-3 z-[1000] flex flex-wrap items-center gap-1.5 rounded border border-[var(--cx-border)] bg-[rgba(18,16,37,0.92)] px-2.5 py-1.5 backdrop-blur shadow-lg">
          <span className="cx-mono text-[9px] font-bold uppercase tracking-wider text-[var(--cx-accent)] mr-1">
            SPATIAL REGIONS:
          </span>
          {QUICK_REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => jumpToRegion(r)}
              className={`cx-mono rounded px-2.5 py-1 text-[10px] font-bold transition ${
                selectedRegion === r.id
                  ? "bg-[rgba(237,142,89,0.25)] text-[var(--cx-accent)] border border-[rgba(237,142,89,0.45)]"
                  : "text-[var(--cx-text-muted)] hover:text-white"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Top-Right Multi-Base Satellite Tile Selector */}
      <div className="absolute right-3 top-3 z-[1000] flex items-center gap-1 rounded border border-[var(--cx-border)] bg-[rgba(18,16,37,0.92)] p-1 backdrop-blur shadow-lg">
        {(
          [
            { id: "google", label: "🛰️ Satellite HD" },
            { id: "esri", label: "🌍 Esri Imagery" },
            { id: "dark", label: "🌙 Dark Matter" },
            { id: "topo", label: "🏔️ Topo Relief" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setBaseTile(t.id)}
            className={`cx-mono rounded px-2 py-1 text-[10px] font-semibold transition ${
              baseTile === t.id
                ? "bg-[var(--cx-surface)] text-[var(--cx-accent)] border border-[rgba(237,142,89,0.35)]"
                : "text-[var(--cx-text-muted)] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Bottom-Left Layer Toggles */}
      <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap items-center gap-2 rounded border border-[var(--cx-border)] bg-[rgba(18,16,37,0.92)] px-3 py-1.5 backdrop-blur shadow-lg">
        <span className="cx-mono text-[9px] font-bold uppercase tracking-wider text-[var(--cx-text-muted)] mr-1">
          LAYERS:
        </span>
        {(
          [
            { key: "boundary", label: "Boundary", color: "#ED8E59" },
            { key: "projects", label: "Project Pins", color: "#ED8E59" },
            { key: "firms", label: "FIRMS Detections", color: "#E56B78" },
            { key: "estimated", label: "Impact Buffer", color: "#E8BCCB" },
            { key: "incidents", label: "Incidents", color: "#72B084" },
          ] as const
        ).map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleLayer(key)}
            className={`cx-mono flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[9px] transition ${
              layers[key]
                ? "bg-[rgba(232,188,203,0.1)] text-[var(--cx-text)] font-bold"
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

      {/* Bottom-Right Live Coordinates HUD */}
      {cursorCoords && (
        <div className="cx-mono absolute bottom-3 right-3 z-[1000] hidden rounded border border-[var(--cx-border)] bg-[rgba(18,16,37,0.85)] px-2.5 py-1 text-[9px] text-[var(--cx-text-muted)] backdrop-blur sm:block">
          LAT: <span className="text-white">{cursorCoords.lat.toFixed(4)}°N</span> ·
          LNG: <span className="text-white">{cursorCoords.lng.toFixed(4)}°E</span>
        </div>
      )}
    </div>
  );
}
