'use client';

import { Building2, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDemoMode } from '@/components/DemoProvider';
import { InfoPanel } from '@/components/InfoPanel';
import { MapView } from '@/components/MapView';
import { NavBar } from '@/components/NavBar';
import {
  fetchBlocks,
  fetchCityStats,
  fetchEquityAlerts,
  fetchWorkOrders,
} from '@/lib/api';
import type { ActiveView, Block, CityStats, EquityAlert, WorkOrder } from '@/types';

const VIEWS: { id: ActiveView; label: string }[] = [
  { id: 'heat', label: 'Heat' },
  { id: 'equity', label: 'Equity' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'flood', label: 'Flood' },
  { id: 'aqi', label: 'Air' },
];

const PANEL_W = 320; // w-80
const PANEL_COLLAPSED = 40; // w-10
const NAV_H = 52;
const DEMO_BANNER_H = 36;

interface HomeShellProps {
  /** Server-rendered panel (e.g. `<DashboardPanel />`) — passed from `page.tsx`. */
  rightPanel: ReactNode;
}

export function HomeShell({ rightPanel }: HomeShellProps) {
  const { demoMode } = useDemoMode();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equityAlerts, setEquityAlerts] = useState<EquityAlert[]>([]);
  const [cityStats, setCityStats] = useState<CityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('heat');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [mapThreshold, setMapThreshold] = useState(0);
  const [mapFeaturesOpen, setMapFeaturesOpen] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(false);
  const [showTransit, setShowTransit] = useState(false);
  const [showPlaceLabels, setShowPlaceLabels] = useState(false);
  const [showRoadLabels, setShowRoadLabels] = useState(false);
  const [show3DBuildings, setShow3DBuildings] = useState(false);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const mapFeaturesRef = useRef<HTMLDivElement>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [b, wo, ea, cs] = await Promise.all([
        fetchBlocks(demoMode),
        fetchWorkOrders(demoMode),
        fetchEquityAlerts(demoMode),
        fetchCityStats(demoMode),
      ]);
      setBlocks(b);
      setWorkOrders(wo);
      setEquityAlerts(ea);
      setCityStats(cs);
    } catch (e) {
      console.error(e);
      setBlocks([]);
      setWorkOrders([]);
      setEquityAlerts([]);
      setCityStats(null);
    } finally {
      setLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!viewMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setViewMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [viewMenuOpen]);

  useEffect(() => {
    if (!mapFeaturesOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (mapFeaturesRef.current && !mapFeaturesRef.current.contains(e.target as Node)) {
        setMapFeaturesOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [mapFeaturesOpen]);

  const bannerH = demoMode ? DEMO_BANNER_H : 0;
  const panelTop = bannerH + NAV_H;

  const mapBlocks = mapThreshold > 0
    ? blocks.filter(b => getMapSeverity(b, activeView) >= mapThreshold)
    : blocks;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[var(--cl-page)]">
      {/* Map: full viewport under UI; canvas size does not change when panels toggle. */}
      <div className="absolute inset-0 z-0 min-h-0">
        <MapView
          blocks={mapBlocks}
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
          activeView={activeView}
          loading={loading}
          demoMode={demoMode}
          leftPanelOpen={leftOpen}
          showLandmarks={showLandmarks}
          showTransit={showTransit}
          showPlaceLabels={showPlaceLabels}
          showRoadLabels={showRoadLabels}
          show3DBuildings={show3DBuildings}
        />
      </div>

      <div
        className="absolute left-0 right-0 z-20 flex flex-col border-b border-[var(--cl-border)] bg-[var(--cl-surface)]/95 backdrop-blur-sm"
        style={{ top: bannerH, height: NAV_H }}
      >
        <NavBar onRefresh={loadAll} />
      </div>

      {/* Floating controls — sits just right of the left panel */}
      <div
        className="absolute z-15 flex flex-col gap-2 transition-[left] duration-300 ease-out"
        style={{ left: leftOpen ? PANEL_W + 12 : PANEL_COLLAPSED + 12, top: panelTop + 12 }}
      >
        {/* Layers / view filter */}
        <div ref={viewMenuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={viewMenuOpen}
            aria-label={`Map view: ${VIEWS.find((v) => v.id === activeView)?.label ?? 'Heat'}. Open menu to change layer.`}
            onClick={() => setViewMenuOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid var(--cl-border-bright)',
              background: 'var(--cl-surface)',
              color: 'var(--cl-green-800)',
              boxShadow: '0 2px 8px rgba(42,38,33,0.10)',
              transition: 'var(--transition)',
            }}
          >
            <Layers size={20} strokeWidth={2.25} aria-hidden />
          </button>
          {viewMenuOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 160,
                borderRadius: 12,
                background: 'var(--cl-card)',
                border: '1px solid var(--cl-border)',
                boxShadow: '0 10px 28px rgba(42,38,33,0.12)',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              {VIEWS.map((v) => {
                const isActive = activeView === v.id;
                return (
                  <div key={v.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => { setActiveView(v.id); setViewMenuOpen(false); }}
                      className={isActive ? 'bg-[rgba(109,128,105,0.18)]' : 'bg-transparent hover:bg-[rgba(109,128,105,0.10)]'}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '10px 16px',
                        border: 'none',
                        color: 'var(--cl-text-primary)',
                        fontFamily: 'var(--font-display)',
                        fontSize: 14,
                        fontWeight: isActive ? 700 : 500,
                        transition: 'background 0.15s',
                      }}
                    >
                      {v.label}
                    </button>
                  </div>
                );
              })}
              {/* Threshold slider */}
              <div style={{ borderTop: '1px solid var(--cl-border)', padding: '10px 14px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--cl-text-muted)',
                    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em',
                  }}>
                    Map threshold
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600,
                    color: mapThreshold > 0 ? 'var(--cl-red-400)' : 'var(--cl-text-muted)',
                  }}>
                    {mapThreshold === 0 ? 'All' : `≥ ${mapThreshold}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={mapThreshold}
                  onChange={(e) => setMapThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cl-green-700)', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--cl-text-muted)' }}>Show all</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--cl-text-muted)' }}>Worst only</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map features — landmarks & 3D buildings */}
        <div ref={mapFeaturesRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={mapFeaturesOpen}
            aria-label="Map features"
            onClick={() => setMapFeaturesOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid var(--cl-border-bright)',
              background: (showLandmarks || showTransit || showPlaceLabels || showRoadLabels || show3DBuildings) ? 'var(--cl-green-700)' : 'var(--cl-surface)',
              color: (showLandmarks || showTransit || showPlaceLabels || showRoadLabels || show3DBuildings) ? 'var(--cl-on-accent)' : 'var(--cl-green-800)',
              boxShadow: '0 2px 8px rgba(42,38,33,0.10)',
              transition: 'var(--transition)',
            }}
          >
            <Building2 size={20} strokeWidth={2.25} aria-hidden />
          </button>
          {mapFeaturesOpen && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                minWidth: 180,
                borderRadius: 12,
                background: 'var(--cl-card)',
                border: '1px solid var(--cl-border)',
                boxShadow: '0 10px 28px rgba(42,38,33,0.12)',
                zIndex: 200,
                overflow: 'hidden',
              }}
            >
              {([
                { key: 'landmarks',    label: 'Landmarks',    value: showLandmarks,    set: setShowLandmarks },
                { key: 'transit',      label: 'Transit',      value: showTransit,      set: setShowTransit },
                { key: 'placeLabels',  label: 'Place labels', value: showPlaceLabels,  set: setShowPlaceLabels },
                { key: 'roadLabels',   label: 'Road labels',  value: showRoadLabels,   set: setShowRoadLabels },
                { key: '3d',           label: '3D buildings', value: show3DBuildings,  set: setShow3DBuildings },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => item.set((v) => !v)}
                  className={item.value ? 'bg-[rgba(109,128,105,0.18)]' : 'bg-transparent hover:bg-[rgba(109,128,105,0.10)]'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    border: 'none',
                    color: 'var(--cl-text-primary)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: item.value ? 700 : 500,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    width: 14, height: 14, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${item.value ? 'var(--cl-green-700)' : 'var(--cl-border-bright)'}`,
                    background: item.value ? 'var(--cl-green-700)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.value && <span style={{ width: 6, height: 6, borderRadius: 1, background: 'var(--cl-on-accent)' }} />}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Left overlay */}
      <div
        className="absolute left-0 z-10 overflow-hidden border-r border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-[2px_0_12px_rgba(0,0,0,0.06)] transition-[width] duration-300 ease-out [will-change:width]"
        style={{
          top: panelTop,
          bottom: 0,
          width: leftOpen ? PANEL_W : PANEL_COLLAPSED,
        }}
      >
        {leftOpen ? (
          <div className="flex h-full w-full min-w-0">
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <InfoPanel
                selectedBlock={selectedBlock}
                setSelectedBlock={setSelectedBlock}
                blocks={blocks}
                loading={loading}
                demoMode={demoMode}
                activeView={activeView}
                setActiveView={setActiveView}
                workOrders={workOrders}
                equityAlerts={equityAlerts}
              />
            </div>
            <button
              type="button"
              aria-label="Collapse left panel"
              onClick={() => setLeftOpen(false)}
              className="flex w-8 shrink-0 items-center justify-center border-l border-[var(--cl-border)] bg-[var(--cl-card)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-hover)]"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Expand left panel"
            onClick={() => setLeftOpen(true)}
            className="flex h-full w-10 items-center justify-center bg-[var(--cl-card)] text-[var(--cl-text-muted)] hover:bg-[var(--cl-card-hover)]"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        )}
      </div>

      {/* Right overlay — equity dashboard rail */}
      <div
        className="absolute right-0 z-10 flex flex-col overflow-hidden border-l border-[var(--cl-border)] bg-[var(--cl-surface)] shadow-[-2px_0_16px_rgba(28,25,23,0.07)] transition-[width] duration-300 ease-out [will-change:width]"
        style={{
          top: panelTop,
          bottom: 0,
          width: rightOpen ? PANEL_W : PANEL_COLLAPSED,
        }}
      >
        {rightOpen ? (
          <div className="flex h-full min-h-0 w-full min-w-0 flex-row">
            <button
              type="button"
              aria-label="Collapse dashboard panel"
              title="Hide dashboard"
              onClick={() => setRightOpen(false)}
              className="flex w-8 shrink-0 items-center justify-center border-r border-[var(--cl-border)] bg-[var(--cl-card)] text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-card-hover)] hover:text-[var(--cl-text-primary)]"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--cl-surface)]">
              <div className="shrink-0 border-b border-[var(--cl-border)] px-6 pb-3.5 pt-5">
                <p className="font-display text-sm font-semibold text-[var(--cl-text-secondary)]">
                  Dashboard
                </p>
                <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--cl-text-muted)]">
                  Equity · Toronto
                </p>
                {cityStats && (
                  <div className="mt-3 flex gap-4 border-t border-[var(--cl-border)] pt-3">
                    <PanelStat label="Critical" value={cityStats.criticalZones} color="var(--cl-red-400)" />
                    <PanelStat label="Avg Δ°C" value={`+${cityStats.avgTemperatureDelta}°C`} color="var(--cl-heat-700)" />
                    <PanelStat
                      label="Equity"
                      value={`${cityStats.equityScore}/100`}
                      color={cityStats.equityScore < 50 ? 'var(--cl-red-400)' : 'var(--cl-green-800)'}
                    />
                  </div>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--cl-surface)] px-1 pb-8 pt-1">
                {rightPanel}
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Expand dashboard panel"
            title="Show equity dashboard"
            onClick={() => setRightOpen(true)}
            className="flex h-full w-10 shrink-0 items-center justify-center border-r border-[var(--cl-border)] bg-[var(--cl-card)] text-[var(--cl-text-muted)] transition-colors hover:bg-[var(--cl-card-hover)] hover:text-[var(--cl-text-primary)]"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}

function getMapSeverity(block: Block, view: ActiveView): number {
  switch (view) {
    case 'heat':   return block.heatScore;
    case 'equity': return Math.round((10 - block.incomeDecile) * 10);
    case 'canopy': return Math.round(100 - block.treeCanopy);
    case 'flood':  return block.floodRisk === 'high' ? 90 : block.floodRisk === 'medium' ? 50 : 10;
    case 'aqi':    return Math.min(100, Math.round(block.airQualityIndex / 2));
  }
}

function PanelStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--cl-text-muted)', fontWeight: 500, marginBottom: 1 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}
