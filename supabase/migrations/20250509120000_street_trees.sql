-- Toronto street trees (CKAN datastore); point features, one row per STRUCTID.

CREATE TABLE street_trees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  struct_id TEXT NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  object_id INTEGER,
  address TEXT,
  street_name TEXT,
  ward TEXT,
  botanical_name TEXT,
  common_name TEXT,
  dbh_trunk_cm DOUBLE PRECISION,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city_id, struct_id)
);

CREATE INDEX street_trees_geom_gix ON street_trees USING gist (geom);
CREATE INDEX street_trees_city_ix ON street_trees (city_id);
CREATE INDEX street_trees_ward_ix ON street_trees (city_id, ward);
