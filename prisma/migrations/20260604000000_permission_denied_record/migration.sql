-- CreateTable
CREATE TABLE "PermissionDeniedRecord" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "instanceRef" TEXT NOT NULL,
    "resourceRef" TEXT NOT NULL,
    "principal" TEXT,
    "httpStatus" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionDeniedRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PermissionDeniedRecord_instanceRef_createdAt_idx" ON "PermissionDeniedRecord"("instanceRef", "createdAt");

-- CreateIndex
CREATE INDEX "PermissionDeniedRecord_provider_httpStatus_createdAt_idx" ON "PermissionDeniedRecord"("provider", "httpStatus", "createdAt");
