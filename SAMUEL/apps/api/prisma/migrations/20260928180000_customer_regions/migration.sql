-- Região nomeada do cliente (pin + raio). Clientes já gravados ficam sem região.

CREATE TABLE "customer_regions" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "radius_meters" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "customer_regions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_regions_company_id_idx" ON "customer_regions"("company_id");

CREATE UNIQUE INDEX "customer_regions_company_name_lower_idx"
  ON "customer_regions" ("company_id", lower("name"));

ALTER TABLE "customer_regions"
  ADD CONSTRAINT "customer_regions_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customers"
  ADD COLUMN "customer_region_id" UUID;

CREATE INDEX "customers_customer_region_id_idx" ON "customers"("customer_region_id");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_customer_region_id_fkey"
  FOREIGN KEY ("customer_region_id") REFERENCES "customer_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
