-- Persist OSRM navigation steps on published routes (customer dispatch)

ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "planned_steps_json" JSONB;
