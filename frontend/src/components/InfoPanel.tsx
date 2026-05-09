'use client';

import { useState } from 'react';
import type { ActiveView, Block, EquityAlert, WorkOrder } from '@/types';
import { createWorkOrder } from '@/lib/api';

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

export function InfoPanel({
  selectedBlock,
  setSelectedBlock,
  blocks,
  loading,
  demoMode,
  equityAlerts,
  workOrders,
}: Props) {
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

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

  const criticalBlocks = blocks.filter(b => b.severity === 'critical');

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
        />
      )}
    </aside>
  );
}

// ─── Default (no selection) ───────────────────────────────────────────────────
function DefaultPanel({ loading, criticalBlocks, equityAlerts, workOrders, setSelectedBlock }: {
  loading: boolean;
  criticalBlocks: Block[];
  equityAlerts: any[];
  workOrders: any[];
  setSelectedBlock: (b: Block) => void;
}) {
  return (
    <div style={{ padding: '16px 14px' }}>
      <SectionLabel>CRITICAL ZONES</SectionLabel>

      {loading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="loading-shimmer" style={{ height: 60, borderRadius: 8, marginBottom: 6 }} />
        ))
      ) : (
        criticalBlocks.map(block => (
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
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--cl-red-400)', fontWeight: 700 }}>{block.heatScore}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)' }}>
              +{block.temperatureDelta}°C · Decile {block.incomeDecile} · {block.treeCanopy}% canopy
            </div>
          </button>
        ))
      )}

      <SectionLabel style={{ marginTop: 20 }}>EQUITY ALERTS</SectionLabel>
      {equityAlerts.slice(0, 2).map(alert => (
        <div key={alert.id} style={{
          background: 'var(--cl-card)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--cl-red-300)',
            lineHeight: 1.5,
          }}>{alert.message}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', marginTop: 4 }}>
            +{alert.responseTimeGap}d gap vs wealthy zones
          </div>
        </div>
      ))}

      <SectionLabel style={{ marginTop: 20 }}>RECENT ORDERS</SectionLabel>
      {workOrders.slice(0, 3).map(wo => (
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
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)' }}>{wo.department}</div>
          </div>
          <StatusBadge status={wo.status} />
        </div>
      ))}

      <div style={{
        marginTop: 24,
        padding: '12px',
        background: 'var(--cl-card)',
        border: '1px solid var(--cl-border)',
        borderRadius: 8,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--cl-text-muted)',
        lineHeight: 1.6,
      }}>
        ← Click any marker on the map to inspect a city block and trigger AI scoring.
      </div>
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
        fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
        marginBottom: 12, padding: 0, letterSpacing: '0.05em',
      }}>← BACK</button>

      {/* Block header */}
      <div style={{
        background: 'var(--cl-card)',
        border: `1px solid ${severityColor}40`,
        borderLeft: `3px solid ${severityColor}`,
        borderRadius: 8,
        padding: '12px 14px',
        marginBottom: 12,
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--cl-text-primary)',
          marginBottom: 4,
          letterSpacing: '-0.01em',
        }}>{block.name}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {block.severity} · income decile {block.incomeDecile}
        </div>
      </div>

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'HEAT SCORE', value: block.heatScore, color: severityColor, unit: '/100' },
          { label: 'TEMP DELTA', value: `+${block.temperatureDelta}`, color: 'var(--cl-heat-400)', unit: '°C' },
          { label: 'TREE CANOPY', value: block.treeCanopy, color: 'var(--cl-green-400)', unit: '%' },
          { label: 'IMPERVIOUS', value: block.impervious, color: 'var(--cl-text-secondary)', unit: '%' },
          { label: 'POPULATION', value: block.population.toLocaleString(), color: 'var(--cl-text-secondary)', unit: '' },
          { label: 'AQI', value: block.airQualityIndex, color: block.airQualityIndex > 130 ? 'var(--cl-red-400)' : 'var(--cl-heat-400)', unit: '' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--cl-card)',
            border: '1px solid var(--cl-border)',
            borderRadius: 6,
            padding: '8px 10px',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', letterSpacing: '0.08em', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: m.color, letterSpacing: '-0.02em' }}>
              {m.value}<span style={{ fontSize: 11, fontWeight: 400 }}>{m.unit}</span>
            </div>
          </div>
        ))}
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
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)' }}>FLOOD RISK</span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500,
          color: block.floodRisk === 'high' ? 'var(--cl-red-400)' : block.floodRisk === 'medium' ? 'var(--cl-heat-400)' : 'var(--cl-green-400)',
          textTransform: 'uppercase',
        }}>{block.floodRisk}</span>
      </div>

      {/* Interventions */}
      {block.interventions.length > 0 && (
        <>
          <SectionLabel>WATSONX RECOMMENDATIONS</SectionLabel>
          {block.interventions.sort((a, b) => b.priority - a.priority).map((inv, i) => (
            <div key={i} style={{
              background: 'var(--cl-card)',
              border: '1px solid rgba(52,211,153,0.15)',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 6,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--cl-text-primary)' }}>{inv.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-green-400)' }}>−{inv.estimatedReduction}°C</span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', marginBottom: 8 }}>
                ${inv.costPerDegree.toLocaleString()}/°C reduction · Priority {inv.priority}/10
              </div>
              <button
                onClick={() => onCreateOrder(block, inv.type)}
                disabled={creatingOrder}
                style={{
                  width: '100%',
                  background: creatingOrder ? 'var(--cl-green-900)' : 'var(--cl-green-700)',
                  border: '1px solid var(--cl-green-500)',
                  borderRadius: 5,
                  color: 'var(--cl-green-300)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  padding: '6px 0',
                  cursor: creatingOrder ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.06em',
                  transition: 'var(--transition)',
                }}
              >
                {creatingOrder ? 'DISPATCHING...' : '⚡ DISPATCH WORK ORDER'}
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
          border: '1px solid rgba(52,211,153,0.3)',
          borderRadius: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--cl-green-300)',
          lineHeight: 1.5,
        }}>{orderSuccess}</div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.1em',
      color: 'var(--cl-text-muted)',
      marginBottom: 8,
      paddingBottom: 4,
      borderBottom: '1px solid var(--cl-border)',
      ...style,
    }}>{children}</div>
  );
}

function StatusBadge({ status }: { status: WorkOrder['status'] }) {
  const cfg = {
    pending: { color: 'var(--cl-heat-300)', label: 'PENDING' },
    dispatched: { color: 'var(--cl-heat-400)', label: 'SENT' },
    in_progress: { color: 'var(--cl-green-400)', label: 'ACTIVE' },
    completed: { color: 'var(--cl-green-700)', label: 'DONE' },
  }[status];
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      color: cfg.color,
      border: `1px solid ${cfg.color}40`,
      padding: '2px 6px',
      borderRadius: 4,
      letterSpacing: '0.06em',
      flexShrink: 0,
    }}>{cfg.label}</span>
  );
}
