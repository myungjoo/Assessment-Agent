-- CreateTable
CREATE TABLE "ServiceIdentity" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceIdentity_personId_service_key" ON "ServiceIdentity"("personId", "service");

-- AddForeignKey
ALTER TABLE "ServiceIdentity" ADD CONSTRAINT "ServiceIdentity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
