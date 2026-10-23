-- CreateEnum
CREATE TYPE "IntegrationAttemptStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "integration_attempts" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "IntegrationAttemptStatus" NOT NULL DEFAULT 'STARTED',
    "errorMessage" TEXT,
    "externalReference" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "integration_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_attempts_orderId_startedAt_idx" ON "integration_attempts"("orderId", "startedAt");

-- AddForeignKey
ALTER TABLE "integration_attempts" ADD CONSTRAINT "integration_attempts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
