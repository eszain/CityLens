export type HeatSeverity = 'critical' | 'high' | 'medium' | 'low';

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
  floodRisk: 'high' | 'medium' | 'low';
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
