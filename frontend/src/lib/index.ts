export type HeatSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface MlScoring {
  heat_risk?: HeatSeverity | null;
  summary?: string | null;
  top_interventions?: string[] | null;
  confidence?: string | null;
  source?: string | null;
  model?: string | null;
}

export interface Block {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heatScore: number;           // 0-100
  temperatureDelta: number;    // °C above city avg
  severity: HeatSeverity;
  incomeDecile: number;        // 1=lowest, 10=highest
  treeCanopy: number;          // % coverage
  impervious: number;          // % impervious surface
  population: number;
  interventions: Intervention[];
  airQualityIndex: number;
  /** Nearest PM2.5 µg/m³ from API; null if no reading — Air lens uses this for color/size. */
  pm25Ugm3: number | null;
  floodRisk: 'high' | 'medium' | 'low';
  /** Metres from block centroid to nearest flood-plain overlay boundary; null if no flood layers. */
  floodEdgeM: number | null;
  mlScoring?: MlScoring | null;
}

export interface Intervention {
  type: 'tree_planting' | 'cool_roof' | 'permeable_pavement' | 'green_space';
  label: string;
  costPerDegree: number;       // $ per °C reduction
  estimatedReduction: number;  // °C
  priority: number;            // 1-10
}

export interface WorkOrder {
  id: string;
  blockId: string;
  blockName: string;
  department: string;
  intervention: string;
  status: 'pending' | 'dispatched' | 'in_progress' | 'completed';
  createdAt: string;
  severity: HeatSeverity;
  estimatedCompletion?: string;
}

export interface EquityAlert {
  id: string;
  message: string;
  severity: HeatSeverity;
  incomeDecile: number;
  responseTimeGap: number; // days gap vs wealthy neighbourhoods
  timestamp: string;
}

export interface CityStats {
  avgTemperatureDelta: number;
  blocksMonitored: number;
  activeWorkOrders: number;
  equityScore: number;         // 0-100, higher = more equitable
  criticalZones: number;
  workOrdersThisWeek: number;
}

/** Shape of `GET /equity/report` — used by dashboard and map rail. */
export interface EquityReport {
  city: string;
  as_of: string;
  summary: {
    equity_score: number | null;
    low_income_blocks: number;
    under_resourced_alerts: number;
    mean_vuln_low_income: number | null;
    mean_deploy_low_income: number | null;
  };
  alerts: unknown[];
}
