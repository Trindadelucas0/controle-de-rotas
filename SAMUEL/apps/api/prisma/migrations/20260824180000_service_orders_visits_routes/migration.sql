-- Service orders / visits / routes (planning block 07–09)

CREATE TYPE "ServiceOrderPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "ServiceOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "VisitStatus" AS ENUM (
  'SCHEDULED', 'ASSIGNED', 'CANCELLED', 'RESCHEDULED',
  'IN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
);
CREATE TYPE "RouteStatus" AS ENUM (
  'DRAFT', 'PLANNED', 'ASSIGNED', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
);
CREATE TYPE "RouteStopStatus" AS ENUM ('PENDING', 'SKIPPED', 'COMPLETED', 'FAILED');

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "service_order_seq" INTEGER NOT NULL DEFAULT 1000;

CREATE TABLE "service_orders" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "priority" "ServiceOrderPriority" NOT NULL DEFAULT 'NORMAL',
  "status" "ServiceOrderStatus" NOT NULL DEFAULT 'OPEN',
  "due_at" TIMESTAMPTZ(6),
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "visits" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "service_order_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "employee_id" UUID,
  "scheduled_start" TIMESTAMPTZ(6) NOT NULL,
  "scheduled_end" TIMESTAMPTZ(6),
  "status" "VisitStatus" NOT NULL DEFAULT 'SCHEDULED',
  "street" VARCHAR(200),
  "number" VARCHAR(40),
  "complement" VARCHAR(120),
  "district" VARCHAR(120),
  "city" VARCHAR(120),
  "state" VARCHAR(2),
  "zip_code" VARCHAR(16),
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "routes" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "employee_id" UUID,
  "vehicle_id" UUID,
  "date" DATE NOT NULL,
  "status" "RouteStatus" NOT NULL DEFAULT 'DRAFT',
  "roundtrip" BOOLEAN NOT NULL DEFAULT true,
  "origin_name" VARCHAR(200),
  "origin_address" VARCHAR(500),
  "origin_latitude" DOUBLE PRECISION NOT NULL,
  "origin_longitude" DOUBLE PRECISION NOT NULL,
  "planned_distance_meters" INTEGER,
  "planned_duration_seconds" INTEGER,
  "actual_distance_meters" INTEGER,
  "actual_duration_seconds" INTEGER,
  "planned_geometry" geometry(LineString,4326),
  "planned_geometry_json" JSONB,
  "quality" VARCHAR(32),
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "route_stops" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "route_id" UUID NOT NULL,
  "visit_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "RouteStopStatus" NOT NULL DEFAULT 'PENDING',
  "planned_distance_meters" INTEGER,
  "planned_duration_seconds" INTEGER,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- FKs
ALTER TABLE "service_orders"
  ADD CONSTRAINT "service_orders_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders"
  ADD CONSTRAINT "service_orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders"
  ADD CONSTRAINT "service_orders_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "visits"
  ADD CONSTRAINT "visits_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_service_order_id_fkey"
  FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "visits"
  ADD CONSTRAINT "visits_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "routes"
  ADD CONSTRAINT "routes_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "routes"
  ADD CONSTRAINT "routes_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "routes"
  ADD CONSTRAINT "routes_vehicle_id_fkey"
  FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "route_stops"
  ADD CONSTRAINT "route_stops_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "route_stops"
  ADD CONSTRAINT "route_stops_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Uniques / indexes
CREATE UNIQUE INDEX "service_orders_company_id_number_key" ON "service_orders"("company_id", "number");
CREATE INDEX "service_orders_company_id_idx" ON "service_orders"("company_id");
CREATE INDEX "service_orders_customer_id_idx" ON "service_orders"("customer_id");
CREATE INDEX "service_orders_status_idx" ON "service_orders"("status");
CREATE INDEX "service_orders_priority_idx" ON "service_orders"("priority");

CREATE INDEX "visits_company_id_idx" ON "visits"("company_id");
CREATE INDEX "visits_service_order_id_idx" ON "visits"("service_order_id");
CREATE INDEX "visits_customer_id_idx" ON "visits"("customer_id");
CREATE INDEX "visits_employee_id_idx" ON "visits"("employee_id");
CREATE INDEX "visits_scheduled_start_idx" ON "visits"("scheduled_start");
CREATE INDEX "visits_status_idx" ON "visits"("status");

CREATE INDEX "routes_company_id_idx" ON "routes"("company_id");
CREATE INDEX "routes_employee_id_idx" ON "routes"("employee_id");
CREATE INDEX "routes_vehicle_id_idx" ON "routes"("vehicle_id");
CREATE INDEX "routes_date_idx" ON "routes"("date");
CREATE INDEX "routes_status_idx" ON "routes"("status");

CREATE UNIQUE INDEX "route_stops_visit_id_key" ON "route_stops"("visit_id");
CREATE UNIQUE INDEX "route_stops_route_id_sequence_key" ON "route_stops"("route_id", "sequence");
CREATE INDEX "route_stops_company_id_idx" ON "route_stops"("company_id");
CREATE INDEX "route_stops_route_id_idx" ON "route_stops"("route_id");
