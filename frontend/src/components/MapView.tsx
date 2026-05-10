"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Layers as LayersIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchJson } from "@/lib/api";
import type { ActiveView, Block } from "@/types";

type LayerToggle = {
  id: string;
  label: string;
  active: boolean;
};

type GeoJSONFC = GeoJSON.FeatureCollection;

type RiskScore = {
  block_id: string;
  lat: number | null;
  lon: number | null;
  risk_score: number | null;
  forecast_peak_normalized: number | null;
  forecast_peak_temp_k: number | null;
  lst_mean_c: number | null;
  canopy_pct: number | null;
  pm25: number | null;
  vulnerability_score: number | null;
};

const TORONTO_CENTER: [number, number] = [-79.3832, 43.6532];
const DEFAULT_ZOOM = 15.5;

const OVERLAY_KEYS = ["canopy", "zoning", "flood_risk"] as const;

const EMPTY_GEOJSON_FC: GeoJSONFC = { type: "FeatureCollection", features: [] };

function layerNeedsLiveApi(id: string): boolean {
  if (id === "ai_risk" || id === "air_quality" || id === "firms") return true;
  return OVERLAY_KEYS.includes(id as (typeof OVERLAY_KEYS)[number]);
}

function hideLiveApiMapLayers(map: mapboxgl.Map) {
  const layerIds = [
    "overlay-canopy",
    "overlay-canopy-outline",
    "overlay-zoning",
    "overlay-zoning-outline",
    "overlay-flood",
    "overlay-flood-outline",
    "aq-circles",
    "firms-circles",
    "blocks-ai-fill",
    "blocks-ai-outline",
  ];
  for (const lid of layerIds) {
    if (map.getLayer(lid)) map.setLayoutProperty(lid, "visibility", "none");
  }
}

function heatColor(score: number): string {
  if (score >= 85) return "#a84840";
  if (score >= 70) return "#b8673d";
  if (score >= 55) return "#b8876e";
  if (score >= 35) return "#9faa7d";
  return "#6d8069";
}

function equityColor(decile: number): string {
  if (decile <= 2) return "#a84840";
  if (decile <= 4) return "#b8673d";
  if (decile <= 6) return "#b8876e";
  if (decile <= 8) return "#9faa7d";
  return "#6d8069";
}

function canopyColor(pct: number): string {
  if (pct >= 50) return "#3d5242";
  if (pct >= 30) return "#536456";
  if (pct >= 20) return "#87977a";
  if (pct >= 10) return "#cdb09a";
  return "#a84840";
}

function hashBlockId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i);
  return Math.abs(h);
}

/**
 * Air lens: color from PM2.5 (µg/m³). Urban values often sit well below AQI-style
 * cutoffs (100/130), so we use a continuous ramp instead of one flat "low" bucket.
 */
function airLensColorFromPm25(ug: number | null, blockId: string): string {
  if (ug == null || Number.isNaN(ug)) {
    const hue = 200 + (hashBlockId(blockId) % 35);
    return `hsl(${hue}, 32%, 58%)`;
  }
  const v = Math.max(4, Math.min(85, ug));
  const t = (v - 4) / 81;
  const r1 = 34,
    g1 = 211,
    b1 = 238;
  const r2 = 234,
    g2 = 179,
    b2 = 8;
  const r3 = 220,
    g3 = 38,
    b3 = 38;
  if (t < 0.55) {
    const u = t / 0.55;
    return `rgb(${Math.round(r1 + (r2 - r1) * u)},${Math.round(g1 + (g2 - g1) * u)},${Math.round(b1 + (b2 - b1) * u)})`;
  }
  const u = (t - 0.55) / 0.45;
  return `rgb(${Math.round(r2 + (r3 - r2) * u)},${Math.round(g2 + (g3 - g2) * u)},${Math.round(b2 + (b3 - b2) * u)})`;
}

function airLensMarkerSize(ug: number | null, blockId: string): number {
  if (ug == null || Number.isNaN(ug)) return 12 + (hashBlockId(blockId) % 5);
  const v = Math.max(4, Math.min(85, ug));
  return Math.round(12 + (v / 85) * 14);
}

/** Flood lens: softer in-plain color; low uses distance to flood boundary so most blocks are not one flat olive. */
function floodLensColor(block: Block): string {
  if (block.floodRisk === "high") return "#c2410c";
  if (block.floodRisk === "medium") return "#b45309";
  const d = block.floodEdgeM;
  if (d != null && Number.isFinite(d)) {
    const u = Math.max(0, Math.min(1, d / 10000));
    const r = Math.round(78 + u * 52);
    const g = Math.round(108 + u * 42);
    const b = Math.round(100 + u * 38);
    return `rgb(${r},${g},${b})`;
  }
  const hue = 138 + (hashBlockId(block.id) % 22);
  return `hsl(${hue}, 16%, 52%)`;
}

function floodLensMarkerSize(block: Block): number {
  if (block.floodRisk === "high") return 19;
  if (block.floodRisk === "medium") return 17;
  const d = block.floodEdgeM;
  if (d != null && Number.isFinite(d)) {
    return Math.round(12 + Math.max(0, Math.min(1, d / 12000)) * 9);
  }
  return 13 + (hashBlockId(block.id) % 4);
}

function getBlockColor(block: Block, view: ActiveView): string {
  switch (view) {
    case "equity":
      return equityColor(block.incomeDecile);
    case "canopy":
      return canopyColor(block.treeCanopy);
    case "flood":
      return floodLensColor(block);
    case "aqi":
      return airLensColorFromPm25(block.pm25Ugm3, block.id);
    default:
      return heatColor(block.heatScore);
  }
}

export interface MapViewProps {
  blocks: Block[];
  selectedBlock: Block | null;
  setSelectedBlock: (b: Block | null) => void;
  activeView: ActiveView;
  loading: boolean;
  /**
   * When true, optional API map layers (AI risk, canopy/zoning/flood overlays, air, FIRMS) are disabled;
   * the base vulnerability choropleth still loads from the API so the map keeps geographic context.
   */
  demoMode: boolean;
  /** Offset layers control when left overlay is open (336px open / 56px collapsed per layout doc). */
  leftPanelOpen?: boolean;
  showLandmarks?: boolean;
  showTransit?: boolean;
  showPlaceLabels?: boolean;
  showRoadLabels?: boolean;
  show3DBuildings?: boolean;
}

export function MapView({
  blocks,
  selectedBlock,
  setSelectedBlock,
  activeView,
  loading,
  demoMode,
  leftPanelOpen = true,
  showLandmarks = false,
  showTransit = false,
  showPlaceLabels = false,
  showRoadLabels = false,
  show3DBuildings = false,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const layersRef = useRef<LayerToggle[]>([]);
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: "ai_risk", label: "AI risk score (Granite TTM)", active: false },
    { id: "canopy", label: "Tree canopy (sample)", active: false },
    { id: "zoning", label: "Zoning (sample)", active: false },
    { id: "flood_risk", label: "Flood risk (sample)", active: false },
    { id: "air_quality", label: "Air quality (OpenAQ ingest)", active: false },
    { id: "firms", label: "NASA FIRMS hotspots", active: false },
  ]);

  layersRef.current = layers;

  const blocksRef = useRef(blocks);
  const setSelectedBlockRef = useRef(setSelectedBlock);
  blocksRef.current = blocks;
  setSelectedBlockRef.current = setSelectedBlock;

  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() || "", []);

  const syncOverlays = useCallback(async (next: LayerToggle[]) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    const activeKeys = OVERLAY_KEYS.filter((k) => next.find((x) => x.id === k)?.active);

    if (!map.getSource("overlays")) {
      const qs = OVERLAY_KEYS.join(",");
      const data = await fetchJson<GeoJSONFC>(
        `/layers/overlays/geojson?city=toronto&layers=${encodeURIComponent(qs)}`,
      );
      map.addSource("overlays", { type: "geojson", data });
      const defs: Array<{ layerId: string; key: string; color: string }> = [
        { layerId: "overlay-canopy", key: "canopy", color: "#15803d" },
        { layerId: "overlay-zoning", key: "zoning", color: "#a855f7" },
        { layerId: "overlay-flood", key: "flood_risk", color: "#0369a1" },
      ];
      for (const d of defs) {
        map.addLayer({
          id: d.layerId,
          type: "fill",
          source: "overlays",
          slot: "middle",
          filter: ["==", ["get", "layer_key"], d.key],
          layout: { visibility: "none" },
          paint: { "fill-color": d.color, "fill-opacity": 0.28 },
        });
        map.addLayer({
          id: `${d.layerId}-outline`,
          type: "line",
          source: "overlays",
          slot: "middle",
          filter: ["==", ["get", "layer_key"], d.key],
          layout: { visibility: "none" },
          paint: { "line-color": d.color, "line-width": 1, "line-opacity": 0.7 },
        });
      }
    }

    for (const k of OVERLAY_KEYS) {
      const layerId =
        k === "canopy" ? "overlay-canopy" : k === "zoning" ? "overlay-zoning" : "overlay-flood";
      const vis = activeKeys.includes(k) ? "visible" : "none";
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
      if (map.getLayer(`${layerId}-outline`))
        map.setLayoutProperty(`${layerId}-outline`, "visibility", vis);
    }
  }, []);

  const syncAir = useCallback(async (active: boolean) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (active) {
      if (!map.getSource("air_quality")) {
        const data = await fetchJson<GeoJSONFC>("/layers/air_quality/geojson?city=toronto&limit=800");
        map.addSource("air_quality", { type: "geojson", data });
        map.addLayer({
          id: "aq-circles",
          type: "circle",
          source: "air_quality",
          slot: "top",
          layout: { visibility: "visible" },
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["coalesce", ["to-number", ["get", "pm25"]], 0],
              0,
              3,
              80,
              18,
            ],
            "circle-color": "#dc2626",
            "circle-opacity": 0.55,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#ffffff",
          },
        });
      } else if (map.getLayer("aq-circles")) {
        map.setLayoutProperty("aq-circles", "visibility", "visible");
      }
    } else if (map.getLayer("aq-circles")) {
      map.setLayoutProperty("aq-circles", "visibility", "none");
    }
  }, []);

  const syncFirms = useCallback(async (active: boolean) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    if (active) {
      if (!map.getSource("firms")) {
        const data = await fetchJson<GeoJSONFC>("/layers/firms/geojson?city=toronto&limit=800");
        map.addSource("firms", { type: "geojson", data });
        map.addLayer({
          id: "firms-circles",
          type: "circle",
          source: "firms",
          slot: "top",
          layout: { visibility: "visible" },
          paint: {
            "circle-radius": 4,
            "circle-color": "#ea580c",
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff7ed",
          },
        });
      } else if (map.getLayer("firms-circles")) {
        map.setLayoutProperty("firms-circles", "visibility", "visible");
      }
    } else if (map.getLayer("firms-circles")) {
      map.setLayoutProperty("firms-circles", "visibility", "none");
    }
  }, []);

  const syncAiRisk = useCallback(async (active: boolean) => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    if (active) {
      const scores = await fetchJson<RiskScore[]>("/risk-scores?city=toronto");

      // Build a lookup: block UUID → risk_score
      const scoreMap = new Map<string, number>();
      for (const s of scores) {
        if (s.block_id && s.risk_score != null) scoreMap.set(s.block_id, s.risk_score);
      }

      if (!map.getSource("blocks-ai")) {
        // Clone the existing blocks source data and annotate with risk_score
        const src = map.getSource("blocks") as mapboxgl.GeoJSONSource | undefined;
        if (!src) {
          setError("Block data not loaded yet — wait for the map to finish loading.");
          return;
        }
        // Re-fetch so we have the FeatureCollection in hand
        const fc = await fetchJson<GeoJSONFC>("/blocks/geojson?city=toronto");
        for (const feat of fc.features) {
          const bid = feat.id != null ? String(feat.id) : "";
          (feat.properties as Record<string, unknown>).risk_score = scoreMap.get(bid) ?? null;
        }
        map.addSource("blocks-ai", { type: "geojson", data: fc });
        map.addLayer({
          id: "blocks-ai-fill",
          type: "fill",
          source: "blocks-ai",
          slot: "middle",
          layout: { visibility: "visible" },
          paint: {
            "fill-color": [
              "interpolate", ["linear"],
              ["coalesce", ["to-number", ["get", "risk_score"]], 0],
              0,   "#f0fdf4",
              25,  "#86efac",
              50,  "#f97316",
              75,  "#dc2626",
              100, "#7f1d1d",
            ],
            "fill-opacity": 0.78,
          },
        });
        map.addLayer({
          id: "blocks-ai-outline",
          type: "line",
          source: "blocks-ai",
          slot: "middle",
          layout: { visibility: "visible" },
          paint: { "line-color": "#1e293b", "line-opacity": 0.3, "line-width": 0.8 },
        });
      } else {
        map.setLayoutProperty("blocks-ai-fill", "visibility", "visible");
        map.setLayoutProperty("blocks-ai-outline", "visibility", "visible");
      }
    } else {
      if (map.getLayer("blocks-ai-fill")) map.setLayoutProperty("blocks-ai-fill", "visibility", "none");
      if (map.getLayer("blocks-ai-outline")) map.setLayoutProperty("blocks-ai-outline", "visibility", "none");
    }
  }, []);

  const onToggle = useCallback(
    async (id: string, active: boolean) => {
      if (demoMode && active && layerNeedsLiveApi(id)) {
        setError("Turn off Demo to load live map layers from the API.");
        return;
      }

      const next = layersRef.current.map((l) => (l.id === id ? { ...l, active } : l));
      setLayers(next);

      try {
        setError(null);
        if (id === "ai_risk") {
          await syncAiRisk(active);
        } else if (OVERLAY_KEYS.includes(id as (typeof OVERLAY_KEYS)[number])) {
          await syncOverlays(next);
        } else if (id === "air_quality") {
          await syncAir(active);
        } else if (id === "firms") {
          await syncFirms(active);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Layer failed to load");
      }
    },
    [demoMode, syncAir, syncAiRisk, syncFirms, syncOverlays],
  );

  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/standard",
      center: TORONTO_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 55,
      bearing: -17.6,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;
    setMapReady(false);

    map.on("load", () => {
      map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
      map.setConfigProperty("basemap", "showTransitLabels", false);
      map.setConfigProperty("basemap", "showPlaceLabels", false);
      map.setConfigProperty("basemap", "showRoadLabels", false);
      map.setConfigProperty("basemap", "show3dObjects", false);
      try {
        if (!map.getSource("blocks")) {
          map.addSource("blocks", { type: "geojson", data: EMPTY_GEOJSON_FC });
          map.addLayer({
            id: "blocks-fill",
            type: "fill",
            source: "blocks",
            slot: "middle",
            paint: {
              "fill-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["to-number", ["get", "vulnerability_score"]], 0],
                0,
                "#eff3ff",
                25,
                "#bdd7e7",
                50,
                "#6baed6",
                75,
                "#3182bd",
                100,
                "#08519c",
              ],
              "fill-opacity": 0.72,
            },
          });
          map.addLayer({
            id: "blocks-outline",
            type: "line",
            source: "blocks",
            slot: "middle",
            paint: {
              "line-color": "#1e293b",
              "line-opacity": 0.35,
              "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.2, 12, 0.8],
            },
          });
        }

        map.on("click", "blocks-fill", (e) => {
          const f = e.features?.[0];
          if (!f?.properties) return;
          const bid =
            f.id !== undefined && f.id !== null
              ? String(f.id)
              : String(f.properties?.external_id ?? "");
          const html = `
            <div style="font-family:system-ui,sans-serif;min-width:220px">
              <div style="font-weight:600;margin-bottom:6px">${String(f.properties?.name ?? "Area")}</div>
              <div style="font-size:13px;color:#334155">Code: ${String(f.properties?.external_id)}</div>
              <div style="margin-top:8px;font-size:13px">
                Vulnerability: <strong>${String(f.properties?.vulnerability_score ?? "—")}</strong>
              </div>
              <div style="margin-top:4px;font-size:13px">
                Canopy %: ${String(f.properties?.canopy_pct ?? "—")}
              </div>
              <div style="margin-top:4px;font-size:13px">
                LST (°C): ${String(f.properties?.lst_mean_c ?? "—")}
              </div>
              ${
                bid
                  ? `<div style="margin-top:10px"><a style="color:#1d4ed8;font-weight:600" href="/block/${encodeURIComponent(bid)}">Open block detail</a></div>`
                  : ""
              }
            </div>`;
          new mapboxgl.Popup({ closeButton: true }).setLngLat(e.lngLat).setHTML(html).addTo(map);

          const list = blocksRef.current;
          const match = list.find(
            (b) => b.id === bid || b.id === String(f.properties?.external_id),
          );
          if (match) setSelectedBlockRef.current(match);
        });
        map.on("mouseenter", "blocks-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "blocks-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load blocks");
      } finally {
        setMapReady(true);
      }
    });

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  /** Base block polygons + vulnerability (blue choropleth) — always from API when map is ready. */
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const src = map.getSource("blocks") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    let cancelled = false;
    void (async () => {
      try {
        const fc = await fetchJson<GeoJSONFC>("/blocks/geojson?city=toronto");
        if (cancelled || mapRef.current !== map) return;
        src.setData(fc);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load blocks");
          src.setData(EMPTY_GEOJSON_FC);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mapReady]);

  /** Demo: hide optional API-driven layers so toggles do not fetch behind the user's back. */
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;

    if (demoMode) {
      hideLiveApiMapLayers(map);
      setLayers((prev) => prev.map((l) => (layerNeedsLiveApi(l.id) ? { ...l, active: false } : l)));
    }
  }, [mapReady, demoMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setConfigProperty("basemap", "showPointOfInterestLabels", showLandmarks);
  }, [showLandmarks, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setConfigProperty("basemap", "showTransitLabels", showTransit);
  }, [showTransit, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setConfigProperty("basemap", "showPlaceLabels", showPlaceLabels);
  }, [showPlaceLabels, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setConfigProperty("basemap", "showRoadLabels", showRoadLabels);
  }, [showRoadLabels, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setConfigProperty("basemap", "show3dObjects", show3DBuildings);
  }, [show3DBuildings, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (blocks.length === 0) return;

    for (const block of blocks) {
      const color = getBlockColor(block, activeView);
      const isSelected = selectedBlock?.id === block.id;
      const size = (() => {
        if (isSelected) return 28;
        if (activeView === "aqi") {
          return airLensMarkerSize(block.pm25Ugm3, block.id);
        }
        if (activeView === "flood") {
          return floodLensMarkerSize(block);
        }
        return block.heatScore > 70 ? 20 : 14;
      })();

      const el = document.createElement("div");
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        border: ${isSelected ? "3px" : "2px"} solid ${isSelected ? "#fff" : color};
        box-shadow: 0 0 ${isSelected ? 20 : 8}px ${color}80;
        cursor: pointer;
        transition: all 0.2s ease;
        opacity: 0.95;
      `;

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([block.lng, block.lat])
        .addTo(map);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedBlock(isSelected ? null : block);
      });

      markersRef.current.push(marker);
    }
  }, [blocks, activeView, selectedBlock, mapReady, setSelectedBlock]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedBlock) return;
    map.flyTo({
      center: [selectedBlock.lng, selectedBlock.lat],
      zoom: 14,
      pitch: 55,
      duration: 1200,
      essential: true,
    });
  }, [selectedBlock]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 px-6 text-center text-sm text-zinc-700">
        <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="font-medium text-zinc-900">Mapbox token missing</p>
          <p className="mt-2 text-zinc-600">
            Add <code className="rounded bg-zinc-100 px-1 py-0.5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5">frontend/.env.local</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <style>{`@keyframes citylens-spin { to { transform: rotate(360deg); } }`}</style>
      <div ref={containerRef} className="h-full w-full" />

      {loading ? (
        <div
          className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[var(--cl-surface)]/90"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div
            className="h-10 w-10 rounded-full border-2 border-[var(--cl-border)] border-t-[var(--cl-green-700)]"
            style={{ animation: "citylens-spin 0.8s linear infinite" }}
            aria-hidden
          />
          <p className="text-sm font-medium text-[var(--cl-text-muted)]">Loading data…</p>
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute top-4 z-10 flex max-w-sm flex-col gap-3 transition-[left] duration-300 ease-out"
        style={{
          left: leftPanelOpen ? "336px" : "56px",
        }}
      >
        {layersOpen ? (
          <div className="pointer-events-auto rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-md backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Layers</p>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setLayersOpen(false)}
                aria-label="Collapse layers"
              >
                <X size={14} />
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {layers.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800">
                  <input
                    type="checkbox"
                    checked={l.active}
                    onChange={(e) => void onToggle(l.id, e.target.checked)}
                    className="rounded border-zinc-300"
                  />
                  {l.label}
                </label>
              ))}
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-3 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vulnerability (default)</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-700">
                  <span className="h-3 flex-1 rounded bg-gradient-to-r from-[#eff3ff] via-[#6baed6] to-[#08519c]" />
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-zinc-500">
                  <span>Lower</span>
                  <span>Higher</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AI Risk score (Granite TTM)</p>
                <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-700">
                  <span className="h-3 flex-1 rounded bg-gradient-to-r from-[#f0fdf4] via-[#f97316] to-[#7f1d1d]" />
                </div>
                <div className="mt-0.5 flex justify-between text-[11px] text-zinc-500">
                  <span>Low</span>
                  <span>Critical</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLayersOpen(true)}
            aria-label="Open layers"
            className="pointer-events-auto h-10 w-10 bg-white/95 shadow-md backdrop-blur hover:bg-white"
          >
            <LayersIcon size={18} />
          </Button>
        )}

        {error ? (
          <div className="pointer-events-auto rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
