import type { Block, WorkOrder, EquityAlert, CityStats } from '@/types';

export const DEMO_BLOCKS: Block[] = [
  {
    id: 'b001', name: 'Rexdale (W1)',
    lat: 43.7252, lng: -79.5847,
    heatScore: 92, temperatureDelta: 7.4, severity: 'critical',
    incomeDecile: 2, treeCanopy: 8, impervious: 87, population: 4820,
    airQualityIndex: 145, floodRisk: 'high',
    interventions: [
      { type: 'tree_planting', label: 'Street tree program', costPerDegree: 1200, estimatedReduction: 2.1, priority: 9 },
      { type: 'cool_roof', label: 'Cool roof incentive', costPerDegree: 950, estimatedReduction: 1.8, priority: 8 },
    ],
  },
  {
    id: 'b002', name: 'Scarborough (E7)',
    lat: 43.7731, lng: -79.2578,
    heatScore: 88, temperatureDelta: 6.9, severity: 'critical',
    incomeDecile: 3, treeCanopy: 11, impervious: 81, population: 6300,
    airQualityIndex: 138, floodRisk: 'medium',
    interventions: [
      { type: 'permeable_pavement', label: 'Permeable pavement pilot', costPerDegree: 2100, estimatedReduction: 1.4, priority: 7 },
      { type: 'green_space', label: 'Pocket park creation', costPerDegree: 1800, estimatedReduction: 1.6, priority: 8 },
    ],
  },
  {
    id: 'b003', name: 'Jane & Finch',
    lat: 43.7573, lng: -79.5090,
    heatScore: 85, temperatureDelta: 6.2, severity: 'critical',
    incomeDecile: 1, treeCanopy: 6, impervious: 83, population: 8900,
    airQualityIndex: 152, floodRisk: 'high',
    interventions: [
      { type: 'tree_planting', label: 'Community forestry', costPerDegree: 900, estimatedReduction: 2.4, priority: 10 },
      { type: 'cool_roof', label: 'Apartment cool roof', costPerDegree: 800, estimatedReduction: 2.0, priority: 9 },
    ],
  },
  {
    id: 'b004', name: 'Malvern',
    lat: 43.7846, lng: -79.2323,
    heatScore: 79, temperatureDelta: 5.8, severity: 'high',
    incomeDecile: 2, treeCanopy: 14, impervious: 76, population: 5200,
    airQualityIndex: 129, floodRisk: 'medium',
    interventions: [
      { type: 'cool_roof', label: 'Cool roof grants', costPerDegree: 1050, estimatedReduction: 1.6, priority: 7 },
    ],
  },
  {
    id: 'b005', name: 'Weston',
    lat: 43.7005, lng: -79.5239,
    heatScore: 74, temperatureDelta: 5.1, severity: 'high',
    incomeDecile: 3, treeCanopy: 18, impervious: 71, population: 3800,
    airQualityIndex: 118, floodRisk: 'low',
    interventions: [
      { type: 'green_space', label: 'Green corridor', costPerDegree: 2200, estimatedReduction: 1.2, priority: 6 },
    ],
  },
  {
    id: 'b006', name: 'Thorncliffe Park',
    lat: 43.7140, lng: -79.3479,
    heatScore: 68, temperatureDelta: 4.3, severity: 'high',
    incomeDecile: 4, treeCanopy: 22, impervious: 68, population: 7100,
    airQualityIndex: 112, floodRisk: 'low',
    interventions: [
      { type: 'tree_planting', label: 'Park expansion', costPerDegree: 1100, estimatedReduction: 1.8, priority: 7 },
    ],
  },
  {
    id: 'b007', name: 'Parkdale',
    lat: 43.6426, lng: -79.4345,
    heatScore: 55, temperatureDelta: 3.1, severity: 'medium',
    incomeDecile: 5, treeCanopy: 28, impervious: 62, population: 4200,
    airQualityIndex: 98, floodRisk: 'low',
    interventions: [
      { type: 'permeable_pavement', label: 'Laneway greening', costPerDegree: 1900, estimatedReduction: 0.9, priority: 5 },
    ],
  },
  {
    id: 'b008', name: 'Kensington',
    lat: 43.6543, lng: -79.4006,
    heatScore: 44, temperatureDelta: 2.2, severity: 'medium',
    incomeDecile: 6, treeCanopy: 31, impervious: 58, population: 2800,
    airQualityIndex: 87, floodRisk: 'low',
    interventions: [],
  },
  {
    id: 'b009', name: 'Forest Hill',
    lat: 43.6917, lng: -79.4103,
    heatScore: 18, temperatureDelta: 0.4, severity: 'low',
    incomeDecile: 10, treeCanopy: 62, impervious: 31, population: 3100,
    airQualityIndex: 48, floodRisk: 'low',
    interventions: [],
  },
  {
    id: 'b010', name: 'Rosedale',
    lat: 43.6806, lng: -79.3726,
    heatScore: 12, temperatureDelta: -0.3, severity: 'low',
    incomeDecile: 10, treeCanopy: 71, impervious: 24, population: 2200,
    airQualityIndex: 42, floodRisk: 'low',
    interventions: [],
  },
  {
    id: 'b011', name: 'Lawrence Heights',
    lat: 43.7254, lng: -79.4428,
    heatScore: 81, temperatureDelta: 6.0, severity: 'critical',
    incomeDecile: 2, treeCanopy: 10, impervious: 79, population: 5600,
    airQualityIndex: 140, floodRisk: 'medium',
    interventions: [
      { type: 'tree_planting', label: 'Redevelopment greening', costPerDegree: 850, estimatedReduction: 2.2, priority: 9 },
    ],
  },
  {
    id: 'b012', name: 'East York (Industrial)',
    lat: 43.7018, lng: -79.3181,
    heatScore: 63, temperatureDelta: 4.1, severity: 'high',
    incomeDecile: 5, treeCanopy: 19, impervious: 74, population: 1900,
    airQualityIndex: 108, floodRisk: 'medium',
    interventions: [
      { type: 'cool_roof', label: 'Industrial cool roof', costPerDegree: 700, estimatedReduction: 2.1, priority: 8 },
    ],
  },
];

export const DEMO_WORK_ORDERS: WorkOrder[] = [
  {
    id: 'wo-001', blockId: 'b001', blockName: 'Rexdale (W1)',
    department: 'Parks & Urban Forestry', intervention: 'Emergency street tree planting — 140 trees',
    status: 'in_progress', createdAt: '2026-05-07T08:23:00Z', severity: 'critical',
    estimatedCompletion: '2026-06-15',
  },
  {
    id: 'wo-002', blockId: 'b003', blockName: 'Jane & Finch',
    department: 'Buildings & Infrastructure', intervention: 'Cool roof grant — 12 apartment buildings',
    status: 'dispatched', createdAt: '2026-05-08T11:05:00Z', severity: 'critical',
    estimatedCompletion: '2026-07-01',
  },
  {
    id: 'wo-003', blockId: 'b011', blockName: 'Lawrence Heights',
    department: 'Parks & Urban Forestry', intervention: 'Community forestry program — 80 trees',
    status: 'pending', createdAt: '2026-05-09T06:44:00Z', severity: 'critical',
  },
  {
    id: 'wo-004', blockId: 'b002', blockName: 'Scarborough (E7)',
    department: 'Transportation Services', intervention: 'Permeable pavement pilot — 3 blocks',
    status: 'pending', createdAt: '2026-05-09T07:12:00Z', severity: 'critical',
  },
  {
    id: 'wo-005', blockId: 'b004', blockName: 'Malvern',
    department: 'Buildings & Infrastructure', intervention: 'Cool roof grants — 8 buildings',
    status: 'dispatched', createdAt: '2026-05-06T14:30:00Z', severity: 'high',
    estimatedCompletion: '2026-08-01',
  },
  {
    id: 'wo-006', blockId: 'b012', blockName: 'East York (Industrial)',
    department: 'Economic Development', intervention: 'Industrial cool roof program',
    status: 'completed', createdAt: '2026-04-22T09:00:00Z', severity: 'high',
    estimatedCompletion: '2026-05-01',
  },
];

export const DEMO_EQUITY_ALERTS: EquityAlert[] = [
  {
    id: 'ea-001',
    message: 'Low-income zones (decile 1–3) receive heat interventions 47 days later on average than decile 8–10 zones.',
    severity: 'critical', incomeDecile: 2, responseTimeGap: 47,
    timestamp: '2026-05-09T06:00:00Z',
  },
  {
    id: 'ea-002',
    message: 'Rosedale (decile 10) received 3 proactive maintenance visits this quarter. Jane & Finch (decile 1): 0.',
    severity: 'high', incomeDecile: 1, responseTimeGap: 31,
    timestamp: '2026-05-08T12:00:00Z',
  },
  {
    id: 'ea-003',
    message: 'Tree canopy investment per capita is 8.3× higher in top income deciles vs bottom deciles.',
    severity: 'high', incomeDecile: 3, responseTimeGap: 22,
    timestamp: '2026-05-07T09:00:00Z',
  },
];

export const DEMO_CITY_STATS: CityStats = {
  avgTemperatureDelta: 4.2,
  blocksMonitored: 2847,
  activeWorkOrders: 5,
  equityScore: 34,
  criticalZones: 4,
  workOrdersThisWeek: 4,
};
