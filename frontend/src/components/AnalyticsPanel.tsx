'use client';

import { useMemo } from 'react';
import type { Block, WorkOrder, EquityAlert, CityStats } from '@/types';

interface Props {
  blocks: Block[];
  workOrders: WorkOrder[];
  equityAlerts: EquityAlert[];
  cityStats: CityStats | null;
  selectedBlock: Block | null;
  loading: boolean;
  demoMode: boolean;
  activeTab: 'analytics' | 'orders';
  setActiveTab: (t: 'analytics' | 'orders') => void;
  onWorkOrdersChange: (wo: WorkOrder[]) => void;
}

export function AnalyticsPanel({
  blocks,
  workOrders,
  equityAlerts,
  cityStats,
  selectedBlock,
  loading,
  activeTab,
  setActiveTab,
}: Props) {
  return (
    <aside style={{
      height: '100%',
      overflowY: 'auto',
      borderLeft: '1px solid var(--cl-border)',
      background: 'var(--cl-surface)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Tab switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--cl-border)',
        flexShrink: 0,
      }}>
        {(['analytics', 'orders'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1,
            padding: '12px 8px',
            border: 'none',
            background: 'transparent',
            color: activeTab === tab ? 'var(--cl-green-400)' : 'var(--cl-text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            borderBottom: activeTab === tab ? '2px solid var(--cl-green-400)' : '2px solid transparent',
            transition: 'var(--transition)',
            textTransform: 'uppercase',
          }}>
            {tab === 'analytics' ? '📊 Analytics' : '📋 Work Orders'}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px', flex: 1 }}>
        {activeTab === 'analytics' ? (
          <AnalyticsTab
            blocks={blocks}
            cityStats={cityStats}
            equityAlerts={equityAlerts}
            selectedBlock={selectedBlock}
            loading={loading}
          />
        ) : (
          <WorkOrdersTab workOrders={workOrders} loading={loading} />
        )}
      </div>
    </aside>
  );
}

// ─── Analytics ────────────────────────────────────────────────────────────────
function AnalyticsTab({ blocks, cityStats, equityAlerts, selectedBlock, loading }: {
  blocks: Block[];
  cityStats: CityStats | null;
  equityAlerts: EquityAlert[];
  selectedBlock: Block | null;
  loading: boolean;
}) {
  // Group blocks by income decile for equity chart
  const equityData = useMemo(() => {
    const groups: Record<string, { blocks: Block[]; avgHeat: number; avgCanopy: number }> = {};
    for (const b of blocks) {
      const tier = b.incomeDecile <= 3 ? 'Low' : b.incomeDecile <= 6 ? 'Mid' : 'High';
      if (!groups[tier]) groups[tier] = { blocks: [], avgHeat: 0, avgCanopy: 0 };
      groups[tier].blocks.push(b);
    }
    return Object.entries(groups).map(([tier, g]) => ({
      tier,
      avgHeat: Math.round(g.blocks.reduce((s, b) => s + b.heatScore, 0) / g.blocks.length),
      avgCanopy: Math.round(g.blocks.reduce((s, b) => s + b.treeCanopy, 0) / g.blocks.length),
      count: g.blocks.length,
    }));
  }, [blocks]);

  const severityDist = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    blocks.forEach(b => counts[b.severity]++);
    return counts;
  }, [blocks]);

  const total = blocks.length || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* City-level stats */}
      {cityStats && (
        <div>
          <SectionLabel>CITY OVERVIEW</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <StatCard label="Blocks Monitored" value={cityStats.blocksMonitored.toLocaleString()} color="var(--cl-green-400)" />
            <StatCard label="Equity Score" value={`${cityStats.equityScore}/100`} color={cityStats.equityScore < 50 ? 'var(--cl-red-400)' : 'var(--cl-green-400)'} />
            <StatCard label="Critical Zones" value={cityStats.criticalZones} color="var(--cl-red-400)" />
            <StatCard label="Active Orders" value={cityStats.activeWorkOrders} color="var(--cl-heat-400)" />
          </div>
        </div>
      )}

      {/* Severity distribution */}
      <div>
        <SectionLabel>SEVERITY DISTRIBUTION</SectionLabel>
        {loading ? (
          <div className="loading-shimmer" style={{ height: 80, borderRadius: 8 }} />
        ) : (
          <div style={{ background: 'var(--cl-card)', border: '1px solid var(--cl-border)', borderRadius: 8, padding: '12px' }}>
            {Object.entries(severityDist).map(([sev, count]) => {
              const pct = Math.round((count / total) * 100);
              const color = { critical: 'var(--cl-red-400)', high: 'var(--cl-heat-400)', medium: 'var(--cl-heat-300)', low: 'var(--cl-green-400)' }[sev as string] ?? 'var(--cl-green-400)';
              return (
                <div key={sev} style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{sev}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color }}>{count} zones</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--cl-green-950)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Equity vs heat chart */}
      <div>
        <SectionLabel>INCOME VS HEAT SCORE</SectionLabel>
        {loading ? (
          <div className="loading-shimmer" style={{ height: 120, borderRadius: 8 }} />
        ) : (
          <div style={{ background: 'var(--cl-card)', border: '1px solid var(--cl-border)', borderRadius: 8, padding: 12 }}>
            {equityData.map(d => (
              <div key={d.tier} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-muted)' }}>{d.tier} income ({d.count} zones)</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: d.tier === 'Low' ? 'var(--cl-red-400)' : d.tier === 'Mid' ? 'var(--cl-heat-400)' : 'var(--cl-green-400)' }}>
                    Heat: {d.avgHeat}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Heat bar */}
                  <div style={{ flex: 1, height: 6, background: 'var(--cl-green-950)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${d.avgHeat}%`,
                      height: '100%',
                      background: d.tier === 'Low' ? 'var(--cl-red-400)' : d.tier === 'Mid' ? 'var(--cl-heat-400)' : 'var(--cl-green-400)',
                      borderRadius: 3,
                    }} />
                  </div>
                  {/* Canopy dot */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-green-400)' }}>🌳{d.avgCanopy}%</span>
                </div>
              </div>
            ))}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', marginTop: 8, padding: '6px 0 0', borderTop: '1px solid var(--cl-border)', lineHeight: 1.5 }}>
              Low-income zones average {equityData.find(d => d.tier === 'Low')?.avgHeat ?? '—'} heat score vs {equityData.find(d => d.tier === 'High')?.avgHeat ?? '—'} in high-income areas.
            </div>
          </div>
        )}
      </div>

      {/* Selected block deep dive */}
      {selectedBlock && (
        <div>
          <SectionLabel>SELECTED: {selectedBlock.name.toUpperCase()}</SectionLabel>
          <BlockSparklines block={selectedBlock} />
        </div>
      )}

      {/* watsonx governance */}
      <div>
        <SectionLabel>WATSONX GOVERNANCE</SectionLabel>
        <div style={{ background: 'var(--cl-card)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 12 }}>
          {equityAlerts.map(alert => (
            <div key={alert.id} style={{
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: '1px solid var(--cl-border)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 4,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cl-red-400)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-red-300)', letterSpacing: '0.06em' }}>EQUITY VIOLATION</span>
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-secondary)', lineHeight: 1.5 }}>
                {alert.message}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Block sparklines ─────────────────────────────────────────────────────────
function BlockSparklines({ block }: { block: Block }) {
  const metrics = [
    { label: 'Heat Score', value: block.heatScore, max: 100, color: block.heatScore > 70 ? 'var(--cl-red-400)' : 'var(--cl-heat-400)' },
    { label: 'Impervious Surface', value: block.impervious, max: 100, color: 'var(--cl-heat-400)' },
    { label: 'Tree Canopy', value: block.treeCanopy, max: 100, color: 'var(--cl-green-400)' },
    { label: 'Air Quality Index', value: Math.min(block.airQualityIndex, 200), max: 200, color: block.airQualityIndex > 130 ? 'var(--cl-red-400)' : 'var(--cl-heat-300)' },
  ];

  return (
    <div style={{ background: 'var(--cl-card)', border: '1px solid var(--cl-border)', borderRadius: 8, padding: 12 }}>
      {metrics.map(m => (
        <div key={m.label} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)' }}>{m.label}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: m.color }}>{m.value}</span>
          </div>
          <div style={{ height: 4, background: 'var(--cl-green-950)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: `${(m.value / m.max) * 100}%`, height: '100%', background: m.color, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Work Orders tab ──────────────────────────────────────────────────────────
function WorkOrdersTab({ workOrders, loading }: { workOrders: WorkOrder[]; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="loading-shimmer" style={{ height: 72, borderRadius: 8 }} />
        ))}
      </div>
    );
  }

  const grouped = {
    pending: workOrders.filter(w => w.status === 'pending'),
    dispatched: workOrders.filter(w => w.status === 'dispatched'),
    in_progress: workOrders.filter(w => w.status === 'in_progress'),
    completed: workOrders.filter(w => w.status === 'completed'),
  };

  return (
    <div>
      {/* Pipeline status */}
      <div style={{
        background: 'var(--cl-card)',
        border: '1px solid var(--cl-border)',
        borderRadius: 8,
        padding: '10px 12px',
        marginBottom: 12,
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 4,
        textAlign: 'center',
      }}>
        {[
          { label: 'Pending', count: grouped.pending.length, color: 'var(--cl-heat-300)' },
          { label: 'Sent', count: grouped.dispatched.length, color: 'var(--cl-heat-400)' },
          { label: 'Active', count: grouped.in_progress.length, color: 'var(--cl-green-400)' },
          { label: 'Done', count: grouped.completed.length, color: 'var(--cl-text-muted)' },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <SectionLabel>ALL WORK ORDERS</SectionLabel>
      {workOrders.map(wo => (
        <WorkOrderCard key={wo.id} wo={wo} />
      ))}

      {workOrders.length === 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--cl-text-muted)', textAlign: 'center', padding: 24 }}>
          No work orders yet. Select a critical block and dispatch one.
        </div>
      )}
    </div>
  );
}

function WorkOrderCard({ wo }: { wo: WorkOrder }) {
  const statusColors = {
    pending: 'var(--cl-heat-300)',
    dispatched: 'var(--cl-heat-400)',
    in_progress: 'var(--cl-green-400)',
    completed: 'var(--cl-text-muted)',
  };

  const severityBorder = {
    critical: 'var(--cl-red-500)',
    high: 'var(--cl-heat-500)',
    medium: 'var(--cl-heat-300)',
    low: 'var(--cl-green-500)',
  };

  return (
    <div style={{
      background: 'var(--cl-card)',
      border: '1px solid var(--cl-border)',
      borderLeft: `3px solid ${severityBorder[wo.severity]}`,
      borderRadius: 8,
      padding: '10px 12px',
      marginBottom: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: 'var(--cl-text-primary)', marginBottom: 2 }}>
            {wo.blockName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)' }}>{wo.department}</div>
        </div>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: statusColors[wo.status],
          border: `1px solid ${statusColors[wo.status]}40`,
          padding: '2px 6px',
          borderRadius: 4,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>{wo.status.replace('_', ' ')}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cl-text-secondary)', lineHeight: 1.4 }}>
        {wo.intervention}
      </div>
      {wo.estimatedCompletion && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', marginTop: 4 }}>
          ETA: {new Date(wo.estimatedCompletion).toLocaleDateString('en-CA')}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
      color: 'var(--cl-text-muted)', marginBottom: 8, paddingBottom: 4,
      borderBottom: '1px solid var(--cl-border)',
    }}>{children}</div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{
      background: 'var(--cl-card)',
      border: '1px solid var(--cl-border)',
      borderRadius: 6,
      padding: '8px 10px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--cl-text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
