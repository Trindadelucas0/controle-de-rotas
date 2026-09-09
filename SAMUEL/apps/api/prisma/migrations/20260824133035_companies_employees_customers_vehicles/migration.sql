-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('OK', 'PENDING', 'FAILED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "address" VARCHAR(500),
ADD COLUMN     "document" VARCHAR(32),
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "phone" VARCHAR(40),
ADD COLUMN     "trade_name" VARCHAR(200);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(255),
    "job_title" VARCHAR(120),
    "registration" VARCHAR(80),
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "region" VARCHAR(120),
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "document" VARCHAR(32),
    "phone" VARCHAR(40),
    "whatsapp" VARCHAR(40),
    "email" VARCHAR(255),
    "street" VARCHAR(200),
    "number" VARCHAR(40),
    "complement" VARCHAR(120),
    "district" VARCHAR(120),
    "city" VARCHAR(120),
    "state" VARCHAR(2),
    "zip_code" VARCHAR(16),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "location_status" "LocationStatus" NOT NULL DEFAULT 'PENDING',
    "category" VARCHAR(80),
    "priority" VARCHAR(40),
    "notes" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "plate" VARCHAR(16) NOT NULL,
    "brand" VARCHAR(80),
    "model" VARCHAR(80),
    "year" INTEGER,
    "fuel_type" VARCHAR(40),
    "avg_consumption" DOUBLE PRECISION,
    "capacity" DOUBLE PRECISION,
    "odometer_km" DOUBLE PRECISION,
    "status" "VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");

-- CreateIndex
CREATE INDEX "employees_status_idx" ON "employees"("status");

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "customers_document_idx" ON "customers"("document");

-- CreateIndex
CREATE INDEX "customers_status_idx" ON "customers"("status");

-- CreateIndex
CREATE INDEX "vehicles_company_id_idx" ON "vehicles"("company_id");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "vehicles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_plate_key" ON "vehicles"("company_id", "plate");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
