-- CreateEnum
CREATE TYPE "FuelFillStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FuelPaymentMethod" AS ENUM ('FUEL_CARD', 'COMPANY_CARD', 'CASH', 'PIX', 'OTHER');

-- CreateEnum
CREATE TYPE "VehicleCostType" AS ENUM ('FUEL', 'MAINTENANCE', 'TIRES', 'TOLL', 'PARKING', 'WASH', 'OTHER');

-- CreateEnum
CREATE TYPE "OdometerReadingSource" AS ENUM ('ROUTE_START', 'ROUTE_END', 'FUEL_FILL', 'ADMIN_ADJUST', 'MAINTENANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "OcrStatus" AS ENUM ('NONE', 'PENDING', 'DONE', 'SKIPPED');

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "reference_fuel_price_per_liter" DECIMAL(12,4),
  ADD COLUMN "fuel_receipt_required" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "route_evidence"
  ADD COLUMN "ocr_status" "OcrStatus" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "ocr_value" VARCHAR(64);

-- CreateTable
CREATE TABLE "fuel_fills" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "employee_id" UUID,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "odometer_km" DECIMAL(12,1) NOT NULL,
    "liters" DECIMAL(12,3) NOT NULL,
    "price_per_liter" DECIMAL(12,4) NOT NULL,
    "total_cost" DECIMAL(14,2) NOT NULL,
    "fuel_type" VARCHAR(40),
    "station" VARCHAR(160),
    "payment_method" "FuelPaymentMethod" NOT NULL DEFAULT 'OTHER',
    "receipt_ref" VARCHAR(80),
    "notes" VARCHAR(500),
    "status" "FuelFillStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID NOT NULL,
    "ocr_odometer_km" DECIMAL(12,1),
    "ocr_status" "OcrStatus" NOT NULL DEFAULT 'NONE',
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fuel_fills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fuel_fill_evidence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "fuel_fill_id" UUID NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_name" VARCHAR(255),
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fuel_fill_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_costs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "type" "VehicleCostType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "fuel_fill_id" UUID,
    "notes" VARCHAR(500),
    "status" "FuelFillStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicle_costs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odometer_readings" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "source" "OdometerReadingSource" NOT NULL,
    "km" DECIMAL(12,1) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "route_id" UUID,
    "fuel_fill_id" UUID,
    "actor_user_id" UUID,
    "note" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odometer_readings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fuel_fills_company_id_occurred_at_idx" ON "fuel_fills"("company_id", "occurred_at");
CREATE INDEX "fuel_fills_company_id_vehicle_id_idx" ON "fuel_fills"("company_id", "vehicle_id");
CREATE INDEX "fuel_fills_company_id_status_idx" ON "fuel_fills"("company_id", "status");
CREATE INDEX "fuel_fill_evidence_company_id_idx" ON "fuel_fill_evidence"("company_id");
CREATE INDEX "fuel_fill_evidence_fuel_fill_id_idx" ON "fuel_fill_evidence"("fuel_fill_id");
CREATE UNIQUE INDEX "vehicle_costs_fuel_fill_id_key" ON "vehicle_costs"("fuel_fill_id");
CREATE INDEX "vehicle_costs_company_id_occurred_at_idx" ON "vehicle_costs"("company_id", "occurred_at");
CREATE INDEX "vehicle_costs_company_id_vehicle_id_type_idx" ON "vehicle_costs"("company_id", "vehicle_id", "type");
CREATE INDEX "vehicle_costs_company_id_status_idx" ON "vehicle_costs"("company_id", "status");
CREATE INDEX "odometer_readings_company_id_vehicle_id_occurred_at_idx" ON "odometer_readings"("company_id", "vehicle_id", "occurred_at");
CREATE INDEX "odometer_readings_route_id_idx" ON "odometer_readings"("route_id");
CREATE INDEX "odometer_readings_fuel_fill_id_idx" ON "odometer_readings"("fuel_fill_id");

ALTER TABLE "fuel_fills" ADD CONSTRAINT "fuel_fills_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_fills" ADD CONSTRAINT "fuel_fills_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_fills" ADD CONSTRAINT "fuel_fills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fuel_fills" ADD CONSTRAINT "fuel_fills_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fuel_fill_evidence" ADD CONSTRAINT "fuel_fill_evidence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fuel_fill_evidence" ADD CONSTRAINT "fuel_fill_evidence_fuel_fill_id_fkey" FOREIGN KEY ("fuel_fill_id") REFERENCES "fuel_fills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fuel_fill_evidence" ADD CONSTRAINT "fuel_fill_evidence_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_fuel_fill_id_fkey" FOREIGN KEY ("fuel_fill_id") REFERENCES "fuel_fills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vehicle_costs" ADD CONSTRAINT "vehicle_costs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_fuel_fill_id_fkey" FOREIGN KEY ("fuel_fill_id") REFERENCES "fuel_fills"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "odometer_readings" ADD CONSTRAINT "odometer_readings_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill odometer history from existing routes (no invented km).
INSERT INTO "odometer_readings" ("id", "company_id", "vehicle_id", "source", "km", "occurred_at", "route_id")
SELECT gen_random_uuid(), r."company_id", r."vehicle_id", 'ROUTE_START', r."start_odometer_km", COALESCE(r."started_at", r."created_at"), r."id"
FROM "routes" r
WHERE r."vehicle_id" IS NOT NULL AND r."start_odometer_km" IS NOT NULL;

INSERT INTO "odometer_readings" ("id", "company_id", "vehicle_id", "source", "km", "occurred_at", "route_id")
SELECT gen_random_uuid(), r."company_id", r."vehicle_id", 'ROUTE_END', r."end_odometer_km", r."updated_at", r."id"
FROM "routes" r
WHERE r."vehicle_id" IS NOT NULL AND r."end_odometer_km" IS NOT NULL;
