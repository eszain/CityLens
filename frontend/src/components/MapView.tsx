'use client';

import { useEffect, useRef, useState } from 'react';
import type { ActiveView, Block } from '@/types';

// Mapbox token — set in .env.local as NEXT_PUBLIC_MAPBOX_TOKEN
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// Heat color scale (muted, earth-adjacent)
function heatColor(score: number): string {
  if (score >= 85) return '#a84840';
  if (score >= 70) return '#b8673d';
  if (score >= 55) return '#b8876e';
  if (score >= 35) return '#9faa7d';
  return '#6d8069';
}

// Equity color (inverse of income decile)
function equityColor(decile: number): string {
  if (decile <= 2) return '#a84840';
  if (decile <= 4) return '#b8673d';
  if (decile <= 6) return '#b8876e';
  if (decile <= 8) return '#9faa7d';
  return '#6d8069';
}

// Canopy color
function canopyColor(pct: number): string {
  if (pct >= 50) return '#3d5242';
  if (pct >= 30) return '#536456';
  if (pct >= 20) return '#87977a';
  if (pct >= 10) return '#cdb09a';
  return '#a84840';
}

function getBlockColor(block: Block, view: ActiveView): string {
  switch (view) {
    case 'equity': return equityColor(block.incomeDecile);
    case 'canopy': return canopyColor(block.treeCanopy);
    case 'flood': return block.floodRisk === 'high' ? '#a84840' : block.floodRisk === 'medium' ? '#b8876e' : '#6d8069';
    case 'aqi': return block.airQualityIndex > 130 ? '#a84840' : block.airQualityIndex > 100 ? '#b8876e' : '#6d8069';
    default: return heatColor(block.heatScore);
  }
}

interface Props {
  blocks: Block[];
  selectedBlock: Block | null;
  setSelectedBlock: (b: Block | null) => void;
  activeView: ActiveView;
  loading: boolean;
}

export function MapView({ blocks, selectedBlock, setSelectedBlock, activeView, loading }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);

  // Init Mapbox
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) { setMapError(true); return; }

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css');
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-79.3832, 43.6532], // Toronto
        zoom: 10.5,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        setMapLoaded(true);
        // Custom map style tweaks
        map.setPaintProperty('background', 'background-color', '#e8e4dc');
      });

      mapRef.current = map;
    }).catch(() => setMapError(true));

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when blocks or view changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || blocks.length === 0) return;

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      // Remove old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      blocks.forEach(block => {
        const color = getBlockColor(block, activeView);
        const isSelected = selectedBlock?.id === block.id;
        const size = isSelected ? 28 : block.heatScore > 70 ? 20 : 14;

        // Create custom marker element
        const el = document.createElement('div');
        el.style.cssText = `
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          background: ${color};
          border: ${isSelected ? '3px' : '2px'} solid ${isSelected ? '#fff' : color};
          box-shadow: 0 0 ${isSelected ? 20 : 8}px ${color}80;
          cursor: pointer;
          transition: all 0.2s ease;
          opacity: 0.9;
        `;

        // Pulse for critical zones
        if (block.severity === 'critical' && !isSelected) {
          el.style.animation = 'none';
          const pulse = document.createElement('div');
          pulse.style.cssText = `
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid ${color};
            animation: pulse-ring 2s ease-out infinite;
            opacity: 0.4;
          `;
          el.appendChild(pulse);
        }

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([block.lng, block.lat])
          .addTo(mapRef.current);

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedBlock(isSelected ? null : block);
        });

        // Tooltip on hover
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 16,
          className: 'citylens-popup',
        }).setHTML(`
          <div style="
            background: #fdfcfa;
            border: 1px solid rgba(55,48,40,0.12);
            border-radius: 10px;
            padding: 10px 14px;
            font-family: 'Source Sans 3', system-ui, sans-serif;
            min-width: 160px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          ">
            <div style="font-weight: 600; color: #2a2621; font-size: 14px; margin-bottom: 4px;">${block.name}</div>
            <div style="color: ${color}; font-size: 13px;">+${block.temperatureDelta}°C · Score ${block.heatScore}</div>
            <div style="color: #8c8478; font-size: 12px; margin-top: 4px;">Income decile ${block.incomeDecile} · ${block.treeCanopy}% canopy</div>
          </div>
        `);

        el.addEventListener('mouseenter', () => popup.addTo(mapRef.current).setLngLat([block.lng, block.lat]));
        el.addEventListener('mouseleave', () => popup.remove());

        markersRef.current.push(marker);
      });
    });
  }, [blocks, activeView, selectedBlock, mapLoaded, setSelectedBlock]);

  // Fly to selected block
  useEffect(() => {
    if (!mapRef.current || !selectedBlock) return;
    mapRef.current.flyTo({
      center: [selectedBlock.lng, selectedBlock.lat],
      zoom: 13.5,
      duration: 1200,
      easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    });
  }, [selectedBlock]);

  if (mapError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'var(--cl-surface)',
        gap: 16,
        padding: 32,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--cl-text-secondary)',
          textAlign: 'center',
        }}>
          Mapbox token required
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--cl-text-muted)', textAlign: 'center', lineHeight: 1.8 }}>
          Add <code style={{ color: 'var(--cl-green-800)' }}>NEXT_PUBLIC_MAPBOX_TOKEN</code><br />
          to your <code>.env.local</code> file
        </div>
        {/* Fallback visual grid */}
        <FallbackMap blocks={blocks} activeView={activeView} selectedBlock={selectedBlock} setSelectedBlock={setSelectedBlock} />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100%', background: 'var(--cl-surface)' }}>
      {/* Map container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Loading overlay */}
      {(loading || !mapLoaded) && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--cl-surface)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid var(--cl-border)',
            borderTopColor: 'var(--cl-green-400)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--cl-text-muted)', fontWeight: 500 }}>
            Loading Toronto data…
          </div>
        </div>
      )}

      {/* Legend */}
      <MapLegend activeView={activeView} />

      {/* Layer label */}
      <div style={{
        position: 'absolute',
        top: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--cl-map-overlay)',
        border: '1px solid var(--cl-map-overlay-border)',
        borderRadius: 10,
        padding: '6px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        color: '#e8e2d6',
        fontWeight: 500,
        backdropFilter: 'blur(10px)',
      }}>
        {activeView.charAt(0).toUpperCase() + activeView.slice(1)} layer · Toronto, ON
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .mapboxgl-ctrl-bottom-right { margin-bottom: 12px; margin-right: 12px; }
        .citylens-popup .mapboxgl-popup-content { background: transparent; padding: 0; border: none; box-shadow: none; }
        .citylens-popup .mapboxgl-popup-tip { display: none; }
      `}</style>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────
function MapLegend({ activeView }: { activeView: ActiveView }) {
  const legends: Record<ActiveView, { label: string; color: string }[]> = {
    heat: [
      { label: 'Critical (≥85)', color: '#a84840' },
      { label: 'High (70–84)', color: '#b8673d' },
      { label: 'Medium (55–69)', color: '#b8876e' },
      { label: 'Low (<55)', color: '#6d8069' },
    ],
    equity: [
      { label: 'Decile 1–2 (poorest)', color: '#a84840' },
      { label: 'Decile 3–4', color: '#b8673d' },
      { label: 'Decile 5–6', color: '#b8876e' },
      { label: 'Decile 7–10', color: '#6d8069' },
    ],
    canopy: [
      { label: '<10% canopy', color: '#a84840' },
      { label: '10–20%', color: '#cdb09a' },
      { label: '20–30%', color: '#87977a' },
      { label: '>30%', color: '#3d5242' },
    ],
    flood: [
      { label: 'High risk', color: '#a84840' },
      { label: 'Medium risk', color: '#b8876e' },
      { label: 'Low risk', color: '#6d8069' },
    ],
    aqi: [
      { label: 'Unhealthy (>130)', color: '#a84840' },
      { label: 'Moderate (100–130)', color: '#b8876e' },
      { label: 'Good (<100)', color: '#6d8069' },
    ],
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: 12,
      background: 'var(--cl-map-overlay)',
      border: '1px solid var(--cl-map-overlay-border)',
      borderRadius: 12,
      padding: '12px 16px',
      backdropFilter: 'blur(10px)',
    }}>
      {legends[activeView].map((item) => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#d4cfc4' }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Fallback grid map (no Mapbox token) ─────────────────────────────────────
function FallbackMap({ blocks, activeView, selectedBlock, setSelectedBlock }: {
  blocks: Block[];
  activeView: ActiveView;
  selectedBlock: Block | null;
  setSelectedBlock: (b: Block | null) => void;
}) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 6,
      padding: 16,
      maxWidth: 500,
      width: '100%',
    }}>
      {blocks.map(block => {
        const color = getBlockColor(block, activeView);
        const isSelected = selectedBlock?.id === block.id;
        return (
          <div
            key={block.id}
            onClick={() => setSelectedBlock(isSelected ? null : block)}
            style={{
              aspectRatio: '1',
              borderRadius: 8,
              background: `${color}22`,
              border: `2px solid ${isSelected ? 'var(--cl-text-primary)' : color}`,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 4,
              transition: 'var(--transition)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, fontWeight: 500, textAlign: 'center', lineHeight: 1.2 }}>
              {block.name.split(' ')[0]}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color, fontWeight: 700 }}>
              {block.heatScore}
            </div>
          </div>
        );
      })}
    </div>
  );
}
