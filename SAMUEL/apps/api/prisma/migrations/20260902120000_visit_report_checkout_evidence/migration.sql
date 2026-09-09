-- CreateEnum
CREATE TYPE "VisitOutcome" AS ENUM ('DONE', 'NO_CONTACT', 'REFUSED', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "VisitEvidenceType" AS ENUM ('PHOTO');

-- AlterTable
ALTER TABLE "visits" ADD COLUMN "checked_out_at" TIMESTAMPTZ(6),
ADD COLUMN "checked_out_lat" DOUBLE PRECISION,
ADD COLUMN "checked_out_lng" DOUBLE PRECISION,
ADD COLUMN "checked_out_accuracy" DOUBLE PRECISION,
ADD COLUMN "outcome" "VisitOutcome",
ADD COLUMN "execution_notes" TEXT;

-- CreateTable
CREATE TABLE "visit_evidence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "visit_id" UUID NOT NULL,
    "type" "VisitEvidenceType" NOT NULL DEFAULT 'PHOTO',
    "storage_key" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_name" VARCHAR(255),
    "caption" VARCHAR(500),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_evidence_company_id_idx" ON "visit_evidence"("company_id");

-- CreateIndex
CREATE INDEX "visit_evidence_visit_id_idx" ON "visit_evidence"("visit_id");

-- AddForeignKey
ALTER TABLE "visit_evidence" ADD CONSTRAINT "visit_evidence_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_evidence" ADD CONSTRAINT "visit_evidence_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_evidence" ADD CONSTRAINT "visit_evidence_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
