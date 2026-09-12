-- CreateEnum
CREATE TYPE "RouteEvidenceKind" AS ENUM ('START_ODOMETER', 'END_ODOMETER');

-- CreateEnum
CREATE TYPE "EmployeeObservationCode" AS ENUM ('KM_DISCREPANCY', 'ODOMETER_ROLLBACK', 'ODOMETER_GAP', 'OFF_ROUTE');

-- CreateEnum
CREATE TYPE "EmployeeObservationStatus" AS ENUM ('OPEN', 'SEEN');

-- CreateEnum
CREATE TYPE "EmployeeObservationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN "last_fuel_level" VARCHAR(32);

-- AlterTable
ALTER TABLE "routes" ADD COLUMN "end_odometer_km" DOUBLE PRECISION,
ADD COLUMN "end_fuel_level" VARCHAR(32),
ADD COLUMN "end_latitude" DOUBLE PRECISION,
ADD COLUMN "end_longitude" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "route_evidence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "kind" "RouteEvidenceKind" NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_name" VARCHAR(255),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "route_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_observations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "route_id" UUID NOT NULL,
    "vehicle_id" UUID,
    "code" "EmployeeObservationCode" NOT NULL,
    "severity" "EmployeeObservationSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "EmployeeObservationStatus" NOT NULL DEFAULT 'OPEN',
    "summary" VARCHAR(500) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_observations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "route_evidence_company_id_idx" ON "route_evidence"("company_id");

-- CreateIndex
CREATE INDEX "route_evidence_route_id_idx" ON "route_evidence"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_observations_route_id_code_key" ON "employee_observations"("route_id", "code");

-- CreateIndex
CREATE INDEX "employee_observations_company_id_employee_id_created_at_idx" ON "employee_observations"("company_id", "employee_id", "created_at");

-- CreateIndex
CREATE INDEX "employee_observations_company_id_status_idx" ON "employee_observations"("company_id", "status");

-- AddForeignKey
ALTER TABLE "route_evidence" ADD CONSTRAINT "route_evidence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_evidence" ADD CONSTRAINT "route_evidence_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_evidence" ADD CONSTRAINT "route_evidence_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_observations" ADD CONSTRAINT "employee_observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_observations" ADD CONSTRAINT "employee_observations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_observations" ADD CONSTRAINT "employee_observations_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_observations" ADD CONSTRAINT "employee_observations_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
