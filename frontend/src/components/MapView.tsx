"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchJson } from "@/lib/api";

type LayerToggle = {
  id: string;
  label: string;
  active: boolean;
};

type GeoJSONFC = GeoJSON.FeatureCollection;

const TORONTO_CENTER: [number, number] = [-79.38, 43.71];
const DEFAULT_ZOOM = 10.2;

const OVERLAY_KEYS = ["canopy", "zoning", "flood_risk", "land_cover"] as const;

const OVERLAY_LAYER_IDS: Record<(typeof OVERLAY_KEYS)[number], string> = {
  canopy: "overlay-canopy",
  zoning: "overlay-zoning",
  flood_risk: "overlay-flood",
  land_cover: "overlay-land-cover",
};

export default function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const layersRef = useRef<LayerToggle[]>([]);
  const [layers, setLayers] = useState<LayerToggle[]>([
    { id: "canopy", label: "Tree canopy (sample)", active: false },
    { id: "zoning", label: "Zoning (sample)", active: false },
    { id: "flood_risk", label: "Flood risk (sample)", active: false },
    { id: "land_cover", label: "Land cover (2018)", active: false },
    { id: "air_quality", label: "Air quality (OpenAQ ingest)", active: false },
    { id: "firms", label: "NASA FIRMS hotspots", active: false },
  ]);

  layersRef.current = layers;

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
        { layerId: "overlay-land-cover", key: "land_cover", color: "#14532d" },
      ];
      for (const d of defs) {
        map.addLayer({
          id: d.layerId,
          type: "fill",
          source: "overlays",
          filter: ["==", ["get", "layer_key"], d.key],
          layout: { visibility: "none" },
          paint: { "fill-color": d.color, "fill-opacity": 0.28 },
        });
        map.addLayer({
          id: `${d.layerId}-outline`,
          type: "line",
          source: "overlays",
          filter: ["==", ["get", "layer_key"], d.key],
          layout: { visibility: "none" },
          paint: { "line-color": d.color, "line-width": 1, "line-opacity": 0.7 },
        });
      }
    }

    for (const k of OVERLAY_KEYS) {
      const layerId = OVERLAY_LAYER_IDS[k];
      const vis = activeKeys.includes(k) ? "visible" : "none";
      if (map.getLayer(layerId)) map.setLayoutProperty(layerId, "visibility", vis);
      if (map.getLayer(`${layerId}-outline`)) map.setLayoutProperty(`${layerId}-outline`, "visibility", vis);
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

  const onToggle = useCallback(
    async (id: string, active: boolean) => {
      const next = layersRef.current.map((l) => (l.id === id ? { ...l, active } : l));
      setLayers(next);

      try {
        setError(null);
        if (OVERLAY_KEYS.includes(id as (typeof OVERLAY_KEYS)[number])) {
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
    [syncAir, syncFirms, syncOverlays],
  );

  useEffect(() => {
    if (!token || !containerRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: TORONTO_CENTER,
      zoom: DEFAULT_ZOOM,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    map.on("load", async () => {
      try {
        const fc = await fetchJson<GeoJSONFC>("/blocks/geojson?city=toronto");
        map.addSource("blocks", { type: "geojson", data: fc });
        map.addLayer({
          id: "blocks-fill",
          type: "fill",
          source: "blocks",
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
          paint: {
            "line-color": "#1e293b",
            "line-opacity": 0.35,
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.2, 12, 0.8],
          },
        });

        map.on("click", "blocks-fill", (e) => {
          const f = e.features?.[0];
          if (!f?.properties?.external_id) return;
          const bid = f.id !== undefined ? String(f.id) : "";
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
                  ? `<div style="margin-top:10px"><a style="color:#1d4ed8;font-weight:600" href="/block/${bid}">Open block detail</a></div>`
                  : ""
              }
            </div>`;
          new mapboxgl.Popup({ closeButton: true }).setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
        map.on("mouseenter", "blocks-fill", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "blocks-fill", () => {
          map.getCanvas().style.cursor = "";
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load blocks");
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

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
      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 z-10 flex max-w-sm flex-col gap-3">
        <div className="pointer-events-auto rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Layers</p>
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
        </div>

        <div className="pointer-events-none rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Vulnerability</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-700">
            <span className="h-3 flex-1 rounded bg-gradient-to-r from-[#eff3ff] via-[#6baed6] to-[#08519c]" />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-zinc-500">
            <span>Lower</span>
            <span>Higher</span>
          </div>
        </div>

        {error ? (
          <div className="pointer-events-auto rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 shadow-sm">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
