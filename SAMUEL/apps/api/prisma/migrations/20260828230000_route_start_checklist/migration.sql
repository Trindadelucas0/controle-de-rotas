-- Checklist de início de rota (campo)
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "start_odometer_km" DOUBLE PRECISION;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "start_fuel_level" VARCHAR(32);
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "start_notes" VARCHAR(500);
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "start_latitude" DOUBLE PRECISION;
ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "start_longitude" DOUBLE PRECISION;
