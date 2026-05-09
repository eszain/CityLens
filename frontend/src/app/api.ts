import type { Block, WorkOrder, EquityAlert, CityStats } from '@/types';
import {
  DEMO_BLOCKS,
  DEMO_WORK_ORDERS,
  DEMO_EQUITY_ALERTS,
  DEMO_CITY_STATS,
} from '../lib/demoData';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// Simulated network delay for demo mode (makes it feel real)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// ─── Generic fetch wrapper ───────────────────────────────────────────────────
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

// ─── Blocks ──────────────────────────────────────────────────────────────────
export async function fetchBlocks(demo: boolean): Promise<Block[]> {
  if (demo) {
    await delay(600);
    return DEMO_BLOCKS;
  }
  return apiFetch<Block[]>('/blocks/');
}

export async function fetchBlock(id: string, demo: boolean): Promise<Block> {
  if (demo) {
    await delay(300);
    const b = DEMO_BLOCKS.find(b => b.id === id);
    if (!b) throw new Error('Block not found');
    return b;
  }
  return apiFetch<Block>(`/blocks/${id}`);
}

// ─── Work orders ─────────────────────────────────────────────────────────────
export async function fetchWorkOrders(demo: boolean): Promise<WorkOrder[]> {
  if (demo) {
    await delay(400);
    return DEMO_WORK_ORDERS;
  }
  return apiFetch<WorkOrder[]>('/work_orders/');
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
  const res = await fetch(`${API_BASE}/work_orders/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block_id: blockId, intervention_type: interventionType }),
  });
  if (!res.ok) throw new Error('Failed to create work order');
  return res.json();
}

// ─── Equity ──────────────────────────────────────────────────────────────────
export async function fetchEquityAlerts(demo: boolean): Promise<EquityAlert[]> {
  if (demo) {
    await delay(350);
    return DEMO_EQUITY_ALERTS;
  }
  return apiFetch<EquityAlert[]>('/equity/alerts');
}

export async function fetchEquityScore(demo: boolean): Promise<{ score: number; breakdown: Record<string, number> }> {
  if (demo) {
    await delay(300);
    return {
      score: 34,
      breakdown: { responseTime: 28, investment: 22, canopy: 41, workOrders: 45 },
    };
  }
  return apiFetch('/equity/score');
}

// ─── City stats ───────────────────────────────────────────────────────────────
export async function fetchCityStats(demo: boolean): Promise<CityStats> {
  if (demo) {
    await delay(200);
    return DEMO_CITY_STATS;
  }
  return apiFetch<CityStats>('/ingest/stats');
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
  return apiFetch<LayerData>(`/layers/${layerType}`);
}

// ─── Scoring (on-demand re-score) ─────────────────────────────────────────────
export async function triggerScoring(blockId: string, demo: boolean): Promise<{ jobId: string; eta: number }> {
  if (demo) {
    await delay(1200);
    return { jobId: `job-${Date.now()}`, eta: 5 };
  }
  const res = await fetch(`${API_BASE}/interventions/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ block_id: blockId }),
  });
  if (!res.ok) throw new Error('Scoring failed');
  return res.json();
}
