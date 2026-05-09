'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
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

  const bannerH = demoMode ? DEMO_BANNER_H : 0;
  const panelTop = bannerH + NAV_H;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[var(--cl-page)]">
      {/* Map: full viewport under UI; canvas size does not change when panels toggle. */}
      <div className="absolute inset-0 z-0 min-h-0">
        <MapView
          blocks={blocks}
          selectedBlock={selectedBlock}
          setSelectedBlock={setSelectedBlock}
          activeView={activeView}
          loading={loading}
          leftPanelOpen={leftOpen}
        />
      </div>

      <div
        className="absolute left-0 right-0 z-20 flex flex-col border-b border-[var(--cl-border)] bg-[var(--cl-surface)]/95 backdrop-blur-sm"
        style={{ top: bannerH, height: NAV_H }}
      >
        <NavBar
          activeView={activeView}
          setActiveView={setActiveView}
          cityStats={cityStats}
          onRefresh={loadAll}
        />
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
