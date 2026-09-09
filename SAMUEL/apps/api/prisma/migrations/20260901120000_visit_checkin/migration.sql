-- Check-in de visita + histórico de eventos (WP1)
ALTER TABLE "visits"
  ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "checked_in_lat" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "checked_in_lng" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "checked_in_accuracy" DOUBLE PRECISION;

DO $$ BEGIN
  CREATE TYPE "VisitEventType" AS ENUM ('CHECK_IN', 'NOTE', 'EVIDENCE', 'CHECK_OUT', 'STATUS_CHANGE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "visit_events" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "visit_id" UUID NOT NULL,
  "type" "VisitEventType" NOT NULL,
  "actor_user_id" UUID,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "accuracy" DOUBLE PRECISION,
  "payload" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "visit_events_company_id_idx" ON "visit_events"("company_id");
CREATE INDEX IF NOT EXISTS "visit_events_visit_id_idx" ON "visit_events"("visit_id");
CREATE INDEX IF NOT EXISTS "visit_events_type_idx" ON "visit_events"("type");

DO $$ BEGIN
  ALTER TABLE "visit_events"
    ADD CONSTRAINT "visit_events_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "visit_events"
    ADD CONSTRAINT "visit_events_visit_id_fkey"
    FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "visit_events"
    ADD CONSTRAINT "visit_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
