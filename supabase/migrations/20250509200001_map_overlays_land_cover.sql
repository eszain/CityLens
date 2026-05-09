-- Allow map overlays for Toronto 2018 Forest / Land Cover (vector polygons from open data).

ALTER TABLE map_overlays DROP CONSTRAINT IF EXISTS map_overlays_layer_key_check;

ALTER TABLE map_overlays ADD CONSTRAINT map_overlays_layer_key_check CHECK (
  layer_key IN ('canopy', 'zoning', 'flood_risk', 'land_cover')
);
