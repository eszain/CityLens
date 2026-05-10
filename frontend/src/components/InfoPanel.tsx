'use client';

import { useState } from 'react';
import type { ActiveView, Block, EquityAlert, WorkOrder } from '@/types';
import { createWorkOrder } from '@/lib/api';
import { AccentCard } from '@/components/ui/accent-card';
import { MetricTile } from '@/components/ui/metric-tile';
import { SectionLabel } from '@/components/ui/section-label';
import { StatusBadge } from '@/components/ui/status-badge';

interface Props {
  selectedBlock: Block | null;
  setSelectedBlock: (b: Block | null) => void;
  blocks: Block[];
  loading: boolean;
  demoMode: boolean;
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  workOrders: WorkOrder[];
  equityAlerts: EquityAlert[];
}

function getSortValue(block: Block, view: ActiveView): number {
  switch (view) {
    case 'heat':   return block.heatScore;
    case 'equity': return -block.incomeDecile;
    case 'canopy': return -block.treeCanopy;
    case 'flood':  return ({ high: 3, medium: 2, low: 1 } as const)[block.floodRisk];
    case 'aqi':    return block.airQualityIndex;
  }
}

export function InfoPanel({
  selectedBlock,
  setSelectedBlock,
  blocks,
  loading,
  demoMode,
  equityAlerts,
  workOrders,
  activeView,
  setActiveView: _setActiveView,
}: Props) {
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  async function handleCreateOrder(block: Block, interventionType: string) {
    setCreatingOrder(true);
    setOrderSuccess(null);
    try {
      await createWorkOrder(block.id, interventionType, demoMode);
      setOrderSuccess(`Work order dispatched to city department.`);
    } catch {
      setOrderSuccess('Failed to create order — check backend connection.');
    } finally {
      setCreatingOrder(false);
    }
  }

  const criticalBlocks = blocks
    .filter(b => b.severity === 'critical')
    .sort((a, b) => sortDir === 'desc'
      ? getSortValue(b, activeView) - getSortValue(a, activeView)
      : getSortValue(a, activeView) - getSortValue(b, activeView)
    );

  return (
    <aside style={{
      height: '100%',
      overflowY: 'auto',
      borderRight: '1px solid var(--cl-border)',
      background: 'var(--cl-surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {selectedBlock ? (
        <BlockDetail
          block={selectedBlock}
          onBack={() => setSelectedBlock(null)}
          onCreateOrder={handleCreateOrder}
          creatingOrder={creatingOrder}
          orderSuccess={orderSuccess}
        />
      ) : (
        <DefaultPanel
          loading={loading}
          criticalBlocks={criticalBlocks}
          equityAlerts={equityAlerts}
          workOrders={workOrders}
          setSelectedBlock={setSelectedBlock}
          sortDir={sortDir}
          setSortDir={setSortDir}
        />
      )}
    </aside>
  );
}

// ─── Default (no selection) ───────────────────────────────────────────────────
function DefaultPanel({ loading, criticalBlocks, equityAlerts, workOrders, setSelectedBlock, sortDir, setSortDir }: {
  loading: boolean;
  criticalBlocks: Block[];
  equityAlerts: any[];
  workOrders: any[];
  setSelectedBlock: (b: Block) => void;
  sortDir: 'asc' | 'desc';
  setSortDir: (d: 'asc' | 'desc') => void;
}) {
  const [open, setOpen] = useState({ priority: true, alerts: true, orders: true });
  const [search, setSearch] = useState('');
  const toggle = (key: keyof typeof open) => setOpen(s => ({ ...s, [key]: !s[key] }));

  const visibleBlocks = search.trim()
    ? criticalBlocks.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : criticalBlocks;

  return (
    <div style={{ padding: '16px 14px' }}>
      <SectionLabel collapsed={!open.priority} onToggle={() => toggle('priority')}>
        High-priority areas
      </SectionLabel>
      {open.priority && <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          type="search"
          placeholder="Search areas…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1,
            background: 'var(--cl-card)',
            border: '1px solid var(--cl-border)',
            borderRadius: 6,
            padding: '5px 10px',
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--cl-text-primary)',
            outline: 'none',
          }}
        />
        <button
          onClick={() => setSortDir(sortDir === 'desc' ? 'asc' : 'desc')}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: '1px solid var(--cl-border)',
            color: 'var(--cl-text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '5px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
          }}
        >
          {sortDir === 'desc' ? '↓ Desc' : '↑ Asc'}
        </button>
      </div>}

      {open.priority && (
        loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: 60, borderRadius: 8, marginBottom: 6 }} />
          ))
        ) : (
          visibleBlocks.map(block => (
            <button key={block.id} onClick={() => setSelectedBlock(block)} style={{
              width: '100%',
              background: 'var(--cl-card)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderLeft: '3px solid var(--cl-red-500)',
              borderRadius: 8,
              padding: '10px 12px',
              cursor: 'pointer',
              marginBottom: 6,
              textAlign: 'left',
              transition: 'var(--transition)',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--cl-card-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--cl-card)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: 'var(--cl-text-primary)' }}>{block.name}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--cl-red-400)', fontWeight: 700 }}>{block.heatScore}</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'var(--cl-text-muted)' }}>
                +{block.temperatureDelta}°C · Decile {block.incomeDecile} · {block.treeCanopy}% canopy
              </div>
            </button>
          ))
        )
      )}

      <SectionLabel style={{ marginTop: 20 }} collapsed={!open.alerts} onToggle={() => toggle('alerts')}>
        Equity alerts
      </SectionLabel>
      {open.alerts && equityAlerts.slice(0, 2).map(alert => (
        <div key={alert.id} style={{
          background: 'var(--cl-card)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: 'var(--font-body)',
            fontSize: 10,
            color: 'var(--cl-red-300)',
            lineHeight: 1.5,
          }}>{alert.message}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--cl-text-muted)', marginTop: 4 }}>
            +{alert.responseTimeGap}d gap vs wealthy zones
          </div>
        </div>
      ))}

      <SectionLabel style={{ marginTop: 20 }} collapsed={!open.orders} onToggle={() => toggle('orders')}>
        Recent orders
      </SectionLabel>
      {open.orders && workOrders.slice(0, 3).map(wo => (
        <div key={wo.id} style={{
          background: 'var(--cl-card)',
          border: '1px solid var(--cl-border)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 6,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--cl-text-primary)', marginBottom: 2 }}>{wo.blockName}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--cl-text-muted)' }}>{wo.department}</div>
          </div>
          <StatusBadge status={wo.status} />
        </div>
      ))}

    </div>
  );
}

// ─── Block detail ─────────────────────────────────────────────────────────────
function BlockDetail({ block, onBack, onCreateOrder, creatingOrder, orderSuccess }: {
  block: Block;
  onBack: () => void;
  onCreateOrder: (b: Block, type: string) => void;
  creatingOrder: boolean;
  orderSuccess: string | null;
}) {
  const [actionsOpen, setActionsOpen] = useState(true);

  const severityColor = {
    critical: 'var(--cl-red-400)',
    high: 'var(--cl-heat-400)',
    medium: 'var(--cl-heat-300)',
    low: 'var(--cl-green-400)',
  }[block.severity];

  return (
    <div style={{ padding: '14px' }}>
      {/* Back button */}
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', color: 'var(--cl-text-muted)',
        fontFamily: 'var(--font-body)', fontSize: 11, cursor: 'pointer',
        marginBottom: 12, padding: 0, letterSpacing: '0.05em',
      }}>← BACK</button>

      {/* Block header */}
      <AccentCard accentColor={severityColor} style={{ marginBottom: 12 }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--cl-text-primary)',
          marginBottom: 4,
          letterSpacing: '-0.01em',
        }}>{block.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--cl-text-muted)', fontWeight: 500 }}>
          {block.severity} · income decile {block.incomeDecile}
        </div>
      </AccentCard>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <MetricTile label="Heat score"  value={block.heatScore}                    unit="/100" color={severityColor} />
        <MetricTile label="Temp delta"  value={`+${block.temperatureDelta}`}        unit="°C"   color="var(--cl-heat-700)" />
        <MetricTile label="Tree canopy" value={block.treeCanopy}                    unit="%"    color="var(--cl-green-800)" />
        <MetricTile label="Impervious"  value={block.impervious}                    unit="%"    color="var(--cl-text-secondary)" />
        <MetricTile label="Population"  value={block.population.toLocaleString()}               color="var(--cl-text-secondary)" />
        <MetricTile label="AQI"         value={block.airQualityIndex}                           color={block.airQualityIndex > 130 ? 'var(--cl-red-400)' : 'var(--cl-heat-700)'} />
      </div>

      {/* Flood risk */}
      <div style={{
        background: 'var(--cl-card)',
        border: '1px solid var(--cl-border)',
        borderRadius: 6,
        padding: '8px 12px',
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--cl-text-muted)', fontWeight: 500 }}>Flood risk</span>
        <span style={{
          fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
          color: block.floodRisk === 'high' ? 'var(--cl-red-400)' : block.floodRisk === 'medium' ? 'var(--cl-heat-700)' : 'var(--cl-green-800)',
          textTransform: 'capitalize',
        }}>{block.floodRisk}</span>
      </div>

      {/* Interventions */}
      {block.interventions.length > 0 && (
        <>
          <SectionLabel collapsed={!actionsOpen} onToggle={() => setActionsOpen(o => !o)}>
            Suggested actions
          </SectionLabel>
          {actionsOpen && block.interventions.sort((a, b) => b.priority - a.priority).map((inv, i) => (
            <div key={i} style={{
              background: 'var(--cl-card)',
              border: '1px solid var(--cl-border)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--cl-text-primary)' }}>{inv.label}</span>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--cl-green-800)' }}>−{inv.estimatedReduction}°C</span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 9, color: 'var(--cl-text-muted)', marginBottom: 8 }}>
                ${inv.costPerDegree.toLocaleString()}/°C reduction · Priority {inv.priority}/10
              </div>
              <button
                onClick={() => onCreateOrder(block, inv.type)}
                disabled={creatingOrder}
                style={{
                  width: '100%',
                  background: creatingOrder ? 'var(--cl-green-800)' : 'var(--cl-green-700)',
                  border: '1px solid var(--cl-green-800)',
                  borderRadius: 8,
                  color: 'var(--cl-on-accent)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '8px 0',
                  cursor: creatingOrder ? 'not-allowed' : 'pointer',
                  transition: 'var(--transition)',
                }}
              >
                {creatingOrder ? 'Sending…' : 'Create work order'}
              </button>
            </div>
          ))}
        </>
      )}

      {orderSuccess && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px',
          background: 'rgba(52,211,153,0.1)',
            border: '1px solid var(--cl-border-bright)',
          borderRadius: 8,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--cl-green-800)',
          lineHeight: 1.5,
        }}>{orderSuccess}</div>
      )}
    </div>
  );
}

