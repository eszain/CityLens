import type { Block, WorkOrder, EquityAlert, CityStats, HeatSeverity } from '@/types';
import {
  DEMO_BLOCKS,
  DEMO_WORK_ORDERS,
  DEMO_EQUITY_ALERTS,
  DEMO_CITY_STATS,
} from '../lib/demoData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export function apiBase(): string {
  return API_BASE;
}

// Simulated network delay for demo mode (makes it feel real)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Generic fetch wrapper ───────────────────────────────────────────────────
export async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ─── Live API shapes → UI models ─────────────────────────────────────────────
type ApiBlockRow = {
  id: string;
  name: string;
  external_id: string;
  vulnerability_score: number | null;
  lst_mean_c: number | null;
  canopy_pct: number | null;
  lat: number | null;
  lng: number | null;
  low_income_flag: boolean | null;
  income_median_cad: number | null;
  population: number | null;
  pm25: number | null;
};

type ApiBlocksList = { items: ApiBlockRow[]; total: number };

type ApiWorkOrderRow = {
  id: string;
  status: string;
  created_at: string;
  block_id?: string | null;
  block_code?: string | null;
  block_vulnerability_score?: number | null;
  intervention_type?: string | null;
  department_name?: string | null;
};

type ApiWorkOrdersList = { items: ApiWorkOrderRow[] };

type ApiEquityReport = {
  summary: {
    equity_score: number | null;
    under_resourced_alerts?: number;
  };
  alerts: Array<Record<string, unknown>>;
};

function severityFromVulnerability(score: number): HeatSeverity {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

/**
 * Approximate income decile (1=lowest, 10=highest) from median income.
 * Toronto median household income ~$84k CAD (2021 census).
 * Falls back to low_income_flag when income_median_cad is unavailable.
 */
function incomeDecileFromMedian(medianCad: number | null, lowIncomeFlag: boolean | null): number {
  if (medianCad != null) {
    const income = Number(medianCad);
    if (income < 40_000) return 1;
    if (income < 55_000) return 2;
    if (income < 65_000) return 3;
    if (income < 72_000) return 4;
    if (income < 80_000) return 5;
    if (income < 90_000) return 6;
    if (income < 105_000) return 7;
    if (income < 125_000) return 8;
    if (income < 160_000) return 9;
    return 10;
  }
  return lowIncomeFlag ? 2 : 6;
}

function mapApiBlockRow(row: ApiBlockRow): Block {
  const heatScore = Math.round(Number(row.vulnerability_score ?? 0));
  const lst = row.lst_mean_c != null ? Number(row.lst_mean_c) : null;
  const temperatureDelta =
    lst != null
      ? Math.max(0, Math.round((lst - 22) * 10) / 10)
      : Math.max(0, Math.round((heatScore / 25) * 10) / 10);
  return {
    id: row.id,
    name: row.name,
    lat: Number(row.lat ?? 0),
    lng: Number(row.lng ?? 0),
    heatScore,
    temperatureDelta,
    severity: severityFromVulnerability(heatScore),
    incomeDecile: incomeDecileFromMedian(row.income_median_cad, row.low_income_flag),
    treeCanopy: Math.round(Number(row.canopy_pct ?? 0)),
    impervious: 0,
    population: row.population ?? 0,
    interventions: [],
    airQualityIndex: row.pm25 != null ? Math.round(Number(row.pm25)) : 50,
    floodRisk: 'low',
  };
}

function mapWorkOrderStatus(s: string): WorkOrder['status'] {
  switch (s) {
    case 'open':
      return 'pending';
    case 'assigned':
      return 'dispatched';
    case 'in_progress':
      return 'in_progress';
    case 'resolved':
      return 'completed';
    default:
      return 'pending';
  }
}

const DEMO_TO_LIVE_INTERVENTION: Record<
  string,
  'tree_canopy' | 'cool_roof' | 'permeable_pavement'
> = {
  tree_planting: 'tree_canopy',
  green_space: 'tree_canopy',
  cool_roof: 'cool_roof',
  permeable_pavement: 'permeable_pavement',
};

function liveInterventionType(uiType: string): 'tree_canopy' | 'cool_roof' | 'permeable_pavement' {
  return DEMO_TO_LIVE_INTERVENTION[uiType] ?? 'tree_canopy';
}

// ─── Blocks ──────────────────────────────────────────────────────────────────
export async function fetchBlocks(demo: boolean): Promise<Block[]> {
  if (demo) {
    await delay(600);
    return DEMO_BLOCKS;
  }
  const data = await fetchJson<ApiBlocksList>('/blocks?city=toronto&limit=5000');
  return (data.items ?? []).map(mapApiBlockRow);
}

export async function fetchBlock(id: string, demo: boolean): Promise<Block> {
  if (demo) {
    await delay(300);
    const b = DEMO_BLOCKS.find(b => b.id === id);
    if (!b) throw new Error('Block not found');
    return b;
  }
  // Backend detail shape is richer than the list row — map to Block
  const row = await fetchJson<ApiBlockRow & { pm25?: number | null }>(`/blocks/${id}?city=toronto`);
  return mapApiBlockRow(row);
}

// ─── Work orders ─────────────────────────────────────────────────────────────
export async function fetchWorkOrders(demo: boolean): Promise<WorkOrder[]> {
  if (demo) {
    await delay(400);
    return DEMO_WORK_ORDERS;
  }
  const data = await fetchJson<ApiWorkOrdersList>('/work-orders?city=toronto&limit=2000');
  return (data.items ?? []).map((wo) => ({
    id: wo.id,
    blockId: wo.block_id ?? '',
    blockName: wo.block_code ?? wo.block_id ?? 'Block',
    department: wo.department_name ?? '—',
    intervention: wo.intervention_type ?? '—',
    status: mapWorkOrderStatus(wo.status),
    createdAt: wo.created_at,
    severity: severityFromVulnerability(Number(wo.block_vulnerability_score ?? 0)),
  }));
}

export async function createWorkOrder(
  blockId: string,
  interventionType: string,
  demo: boolean
): Promise<WorkOrder> {
  if (demo) {
    await delay(800);
    const block = DEMO_BLOCKS.find(b => b.id === blockId);
    return {
      id: `wo-demo-${Date.now()}`,
      blockId,
      blockName: block?.name ?? blockId,
      department: 'Parks & Urban Forestry',
      intervention: interventionType,
      status: 'pending',
      createdAt: new Date().toISOString(),
      severity: block?.severity ?? 'medium',
    };
  }
  const res = await fetch(`${API_BASE}/work-orders/?city=toronto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      block_id: blockId,
      intervention_type: liveInterventionType(interventionType),
    }),
  });
  if (!res.ok) throw new Error('Failed to create work order');
  const created = (await res.json()) as {
    id: string;
    block_id?: string;
    department_name?: string;
    status?: string;
  };
  return {
    id: created.id,
    blockId: created.block_id ?? blockId,
    blockName: '',
    department: created.department_name ?? '—',
    intervention: interventionType,
    status: mapWorkOrderStatus(created.status ?? 'open'),
    createdAt: new Date().toISOString(),
    severity: 'medium',
  };
}

// ─── Equity ──────────────────────────────────────────────────────────────────
export async function fetchEquityAlerts(demo: boolean): Promise<EquityAlert[]> {
  if (demo) {
    await delay(350);
    return DEMO_EQUITY_ALERTS;
  }
  const report = await fetchJson<ApiEquityReport>('/equity/report?city=toronto');
  return (report.alerts ?? []).map((b, i) => {
    const vuln = Number(b.vulnerability_score ?? 0);
    const id = String(b.block_id ?? b.external_id ?? i);
    const name = String(b.name ?? b.external_id ?? 'Area');
    const under = Boolean(b.alert_under_resourced);
    return {
      id,
      message: under
        ? `${name}: flagged as under-resourced for its vulnerability level`
        : `${name}: equity attention — high need in a low-income context`,
      severity: severityFromVulnerability(vuln),
      incomeDecile: b.low_income_flag ? 2 : 6,
      responseTimeGap: 0,
      timestamp: new Date().toISOString(),
    } satisfies EquityAlert;
  });
}

export async function fetchEquityScore(demo: boolean): Promise<{ score: number; breakdown: Record<string, number> }> {
  if (demo) {
    await delay(300);
    return {
      score: 34,
      breakdown: { investment: 22, vulnerability: 68, low_income_coverage: 41, under_resourced_pct: 31 },
    };
  }
  const data = await fetchJson<{ score: number; breakdown: Record<string, number> }>('/equity/score?city=toronto');
  return data;
}

// ─── City stats ───────────────────────────────────────────────────────────────
export async function fetchCityStats(demo: boolean): Promise<CityStats> {
  if (demo) {
    await delay(200);
    return DEMO_CITY_STATS;
  }
  const [report, blocksPayload, woPayload] = await Promise.all([
    fetchJson<ApiEquityReport>('/equity/report?city=toronto'),
    fetchJson<ApiBlocksList>('/blocks/?city=toronto&limit=5000'),
    fetchJson<ApiWorkOrdersList>('/work-orders/?city=toronto&limit=2000'),
  ]);

  const items = blocksPayload.items ?? [];
  const woItems = woPayload.items ?? [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const avgTemperatureDelta =
    items.length === 0
      ? 0
      : Math.round(
          (items.reduce((s, r) => s + Math.max(0, Number(r.lst_mean_c ?? 24) - 22), 0) /
            items.length) *
            10,
        ) / 10;

  const equityRaw = report.summary?.equity_score;
  const equityScore =
    equityRaw != null ? Math.round(Math.max(0, Math.min(1, Number(equityRaw))) * 100) : 55;

  const criticalZones = items.filter((r) => (Number(r.vulnerability_score) || 0) >= 85).length;

  const activeWorkOrders = woItems.filter((w) =>
    ['open', 'assigned', 'in_progress'].includes(w.status),
  ).length;

  const workOrdersThisWeek = woItems.filter(
    (w) => new Date(w.created_at).getTime() >= weekAgo,
  ).length;

  return {
    avgTemperatureDelta,
    blocksMonitored: blocksPayload.total ?? items.length,
    activeWorkOrders,
    equityScore,
    criticalZones,
    workOrdersThisWeek,
  };
}

// ─── Layers (map overlays) ────────────────────────────────────────────────────
export interface LayerData {
  type: 'heat' | 'equity' | 'canopy' | 'flood' | 'aqi';
  geojson: GeoJSON.FeatureCollection;
}

export async function fetchLayer(layerType: string, demo: boolean): Promise<LayerData> {
  if (demo) {
    await delay(500);
    // Return a stub — real GeoJSON injected by MapView from block data
    return { type: layerType as LayerData['type'], geojson: { type: 'FeatureCollection', features: [] } };
  }
  return fetchJson<LayerData>(`/layers/${layerType}`);
}

// ─── Scoring (on-demand re-score) ─────────────────────────────────────────────
export async function triggerScoring(blockId: string, demo: boolean): Promise<{ jobId: string; eta: number }> {
  if (demo) {
    await delay(1200);
    return { jobId: `job-${Date.now()}`, eta: 5 };
  }
  // Backend exposes GET /interventions/score?block_id=... (not POST)
  const res = await fetch(
    `${API_BASE}/interventions/score?block_id=${encodeURIComponent(blockId)}&city=toronto`,
    { headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok) throw new Error('Scoring failed');
  const data = await res.json() as { block_id: string; interventions: unknown[] };
  // Adapt to the expected shape — rescoring is instant server-side
  return { jobId: data.block_id, eta: 0 };
}
