-- Missão Gravar região: centro + raio na rota (opcional; missões antigas ficam NULL)

ALTER TABLE "routes"
  ADD COLUMN IF NOT EXISTS "assignment_region_latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "assignment_region_longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "assignment_region_radius_meters" INTEGER,
  ADD COLUMN IF NOT EXISTS "assignment_region_name" VARCHAR(200);
