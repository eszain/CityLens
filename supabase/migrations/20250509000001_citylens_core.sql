-- CityLens core schema (PostGIS). Apply to Supabase or local PostGIS.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  name TEXT,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  vulnerability_score DOUBLE PRECISION,
  lst_mean_c DOUBLE PRECISION,
  canopy_pct DOUBLE PRECISION,
  scoring_model_version TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, external_id)
);

CREATE INDEX blocks_geom_gix ON blocks USING gist (geom);
CREATE INDEX blocks_city_ix ON blocks (city_id);

CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  intervention_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, name)
);

CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  intervention_type TEXT NOT NULL CHECK (
    intervention_type IN ('tree_canopy', 'cool_roof', 'permeable_pavement')
  ),
  cost_estimate_cad DOUBLE PRECISION NOT NULL,
  projected_temp_reduction_c DOUBLE PRECISION NOT NULL,
  roi_score DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX interventions_block_ix ON interventions (block_id);

CREATE TABLE work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  intervention_id UUID REFERENCES interventions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (
    status IN ('open', 'assigned', 'in_progress', 'resolved')
  ),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  assigned_to UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX work_orders_status_ix ON work_orders (status);
CREATE INDEX work_orders_dept_ix ON work_orders (department_id);

CREATE TABLE demographics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  census_year INT NOT NULL,
  income_median_cad DOUBLE PRECISION,
  income_bracket TEXT,
  population INT,
  low_income_flag BOOLEAN,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (block_id, census_year)
);

CREATE INDEX demographics_block_ix ON demographics (block_id);

CREATE TABLE equity_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  block_id UUID REFERENCES blocks(id) ON DELETE CASCADE,
  resources_deployed DOUBLE PRECISION,
  equity_score DOUBLE PRECISION,
  vulnerability_percentile DOUBLE PRECISION,
  income_percentile DOUBLE PRECISION,
  alert_under_resourced BOOLEAN NOT NULL DEFAULT false,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX equity_snapshots_city_date_ix ON equity_snapshots (city_id, snapshot_date DESC);

-- Toggleable map overlays (canopy, zoning, flood risk): loaded from open data or samples.
CREATE TABLE map_overlays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  layer_key TEXT NOT NULL CHECK (layer_key IN ('canopy', 'zoning', 'flood_risk')),
  label TEXT NOT NULL,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX map_overlays_geom_gix ON map_overlays USING gist (geom);
CREATE INDEX map_overlays_city_layer_ix ON map_overlays (city_id, layer_key);

-- OpenAQ (point readings, spatially joined to blocks in app logic).
CREATE TABLE air_quality_readings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  location GEOMETRY(Point, 4326) NOT NULL,
  pm25 DOUBLE PRECISION,
  pm10 DOUBLE PRECISION,
  o3 DOUBLE PRECISION,
  source TEXT NOT NULL DEFAULT 'openaq',
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX air_quality_city_time_ix ON air_quality_readings (city_id, observed_at DESC);
CREATE INDEX air_quality_location_gix ON air_quality_readings USING gist (location);

-- Thermal history per block (Sentinel zonal stats, FIRMS as auxiliary metadata).
CREATE TABLE block_thermal_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  block_id UUID NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  observed_at DATE NOT NULL,
  lst_mean_c DOUBLE PRECISION,
  source TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (block_id, observed_at, source)
);

CREATE INDEX block_thermal_block_ix ON block_thermal_snapshots (block_id);

-- NASA FIRMS hotspots (points near study area; not block LST).
CREATE TABLE firms_hotspots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  brightness DOUBLE PRECISION,
  scan DOUBLE PRECISION,
  track DOUBLE PRECISION,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX firms_hotspots_geom_gix ON firms_hotspots USING gist (geom);
CREATE INDEX firms_hotspots_time_ix ON firms_hotspots (observed_at DESC);
