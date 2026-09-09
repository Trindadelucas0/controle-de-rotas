-- PostGIS + geometry for customers
CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS location geometry(Point, 4326);

UPDATE customers
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

CREATE INDEX IF NOT EXISTS idx_customers_location
  ON customers USING GIST (location);

CREATE OR REPLACE FUNCTION customers_sync_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_customers_sync_location ON customers;
CREATE TRIGGER trg_customers_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON customers
  FOR EACH ROW
  EXECUTE PROCEDURE customers_sync_location();
