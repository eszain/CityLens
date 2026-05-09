'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnalyticsPanel } from '@/components/AnalyticsPanel';
import { AppRouteNav } from '@/components/AppRouteNav';
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

export function MapWorkspace() {
  const { demoMode } = useDemoMode();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [equityAlerts, setEquityAlerts] = useState<EquityAlert[]>([]);
  const [cityStats, setCityStats] = useState<CityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>('heat');
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [activeTab, setActiveTab] = useState<'analytics' | 'orders'>('analytics');

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

  const shellHeight = demoMode ? 'calc(100dvh - 32px)' : '100dvh';

  return (
    <div
      style={{
        height: shellHeight,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        background: 'var(--cl-page)',
      }}
    >
      <AppRouteNav active="map" />

      <NavBar
        activeView={activeView}
        setActiveView={setActiveView}
        cityStats={cityStats}
        demoMode={demoMode}
        onRefresh={loadAll}
      />

      <div
        style={{
          flex: 1,
          display: 'flex',
          minHeight: 0,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 'var(--sidebar-w)',
            flexShrink: 0,
            minWidth: 0,
            borderRight: '1px solid var(--cl-border)',
          }}
        >
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

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
          <MapView
            blocks={blocks}
            selectedBlock={selectedBlock}
            setSelectedBlock={setSelectedBlock}
            activeView={activeView}
            loading={loading}
          />
        </main>

        <div
          style={{
            width: 'var(--panel-w)',
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <AnalyticsPanel
            blocks={blocks}
            workOrders={workOrders}
            equityAlerts={equityAlerts}
            cityStats={cityStats}
            selectedBlock={selectedBlock}
            loading={loading}
            demoMode={demoMode}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onWorkOrdersChange={setWorkOrders}
          />
        </div>
      </div>
    </div>
  );
}
