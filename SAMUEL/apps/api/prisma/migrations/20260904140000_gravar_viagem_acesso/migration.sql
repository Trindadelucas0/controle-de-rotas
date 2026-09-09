-- Gravar viagem + marcos de acesso à fazenda

-- CreateEnum
CREATE TYPE "CustomerAccessPathStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');
CREATE TYPE "CustomerLandmarkType" AS ENUM ('PORTEIRA', 'PONTE', 'BIFURCACAO', 'ESTRADA_RUIM');

-- AlterTable routes
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "record_trip" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable customer_access_paths
CREATE TABLE IF NOT EXISTS "customer_access_paths" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "route_id" UUID,
    "geometry" geometry(LineString, 4326),
    "geometry_json" JSONB NOT NULL,
    "distance_meters" INTEGER,
    "recorded_by_employee_id" UUID,
    "status" "CustomerAccessPathStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_access_paths_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_access_paths_company_id_idx" ON "customer_access_paths"("company_id");
CREATE INDEX IF NOT EXISTS "customer_access_paths_customer_id_idx" ON "customer_access_paths"("customer_id");
CREATE INDEX IF NOT EXISTS "customer_access_paths_route_id_idx" ON "customer_access_paths"("route_id");
CREATE INDEX IF NOT EXISTS "customer_access_paths_status_idx" ON "customer_access_paths"("status");
CREATE INDEX IF NOT EXISTS "customer_access_paths_company_id_customer_id_status_idx"
  ON "customer_access_paths"("company_id", "customer_id", "status");
CREATE INDEX IF NOT EXISTS "customer_access_paths_geometry_gix"
  ON "customer_access_paths" USING GIST ("geometry");

DO $$ BEGIN
  ALTER TABLE "customer_access_paths" ADD CONSTRAINT "customer_access_paths_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_access_paths" ADD CONSTRAINT "customer_access_paths_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_access_paths" ADD CONSTRAINT "customer_access_paths_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_access_paths" ADD CONSTRAINT "customer_access_paths_recorded_by_employee_id_fkey"
    FOREIGN KEY ("recorded_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable customer_landmarks
CREATE TABLE IF NOT EXISTS "customer_landmarks" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "type" "CustomerLandmarkType" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(300),
    "created_by_employee_id" UUID,
    "location" geometry(Point, 4326),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_landmarks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_landmarks_company_id_idx" ON "customer_landmarks"("company_id");
CREATE INDEX IF NOT EXISTS "customer_landmarks_customer_id_idx" ON "customer_landmarks"("customer_id");
CREATE INDEX IF NOT EXISTS "customer_landmarks_type_idx" ON "customer_landmarks"("type");
CREATE INDEX IF NOT EXISTS "customer_landmarks_location_gix"
  ON "customer_landmarks" USING GIST ("location");

DO $$ BEGIN
  ALTER TABLE "customer_landmarks" ADD CONSTRAINT "customer_landmarks_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_landmarks" ADD CONSTRAINT "customer_landmarks_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "customer_landmarks" ADD CONSTRAINT "customer_landmarks_created_by_employee_id_fkey"
    FOREIGN KEY ("created_by_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION customer_landmarks_sync_location()
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

DROP TRIGGER IF EXISTS customer_landmarks_location_trg ON customer_landmarks;
CREATE TRIGGER customer_landmarks_location_trg
  BEFORE INSERT OR UPDATE OF latitude, longitude ON customer_landmarks
  FOR EACH ROW EXECUTE FUNCTION customer_landmarks_sync_location();
