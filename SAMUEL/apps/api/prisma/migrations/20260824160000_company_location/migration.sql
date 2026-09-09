-- PostGIS location for companies (route origin)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS location_status "LocationStatus" NOT NULL DEFAULT 'PENDING';

UPDATE companies
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
    location_status = 'OK'
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND location IS NULL;

CREATE INDEX IF NOT EXISTS idx_companies_location
  ON companies USING GIST (location);

CREATE OR REPLACE FUNCTION companies_sync_location()
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

DROP TRIGGER IF EXISTS trg_companies_sync_location ON companies;
CREATE TRIGGER trg_companies_sync_location
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON companies
  FOR EACH ROW
  EXECUTE PROCEDURE companies_sync_location();
