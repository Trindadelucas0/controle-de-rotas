-- Missão Gravar cliente: pontos viram clientes; cadastro em aberto (DRAFT)

ALTER TYPE "CustomerStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "profile_incomplete" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "record_session_shell" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "recorded_from_route_id" UUID;

ALTER TABLE "routes"
  ADD COLUMN IF NOT EXISTS "record_new_customer" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "customers_recorded_from_route_id_idx"
  ON "customers"("recorded_from_route_id");
CREATE INDEX IF NOT EXISTS "customers_profile_incomplete_idx"
  ON "customers"("profile_incomplete");

DO $$ BEGIN
  ALTER TABLE "customers" ADD CONSTRAINT "customers_recorded_from_route_id_fkey"
    FOREIGN KEY ("recorded_from_route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
