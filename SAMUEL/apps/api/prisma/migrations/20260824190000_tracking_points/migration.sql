-- AlterTable
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE IF NOT EXISTS "tracking_points" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL,
    "location" geometry(Point, 4326),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_points_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "tracking_points_company_id_idx" ON "tracking_points"("company_id");
CREATE INDEX IF NOT EXISTS "tracking_points_route_id_idx" ON "tracking_points"("route_id");
CREATE INDEX IF NOT EXISTS "tracking_points_employee_id_idx" ON "tracking_points"("employee_id");
CREATE INDEX IF NOT EXISTS "tracking_points_recorded_at_idx" ON "tracking_points"("recorded_at");
CREATE INDEX IF NOT EXISTS "tracking_points_location_gix" ON "tracking_points" USING GIST ("location");

-- ForeignKeys
DO $$ BEGIN
  ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tracking_points" ADD CONSTRAINT "tracking_points_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sync location from lat/lng on insert/update
CREATE OR REPLACE FUNCTION tracking_points_sync_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tracking_points_location_trg ON tracking_points;
CREATE TRIGGER tracking_points_location_trg
  BEFORE INSERT OR UPDATE OF latitude, longitude ON tracking_points
  FOR EACH ROW EXECUTE FUNCTION tracking_points_sync_location();
