-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "difficulty" TEXT NOT NULL,
    "contributionScore" DECIMAL(65,30) NOT NULL,
    "volume" INTEGER NOT NULL,
    "narrative" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "contributionScore" DECIMAL(65,30) NOT NULL,
    "volume" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Summary" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "narrative" TEXT NOT NULL,
    "metricScore" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Assessment_personId_period_periodStart_idx" ON "Assessment"("personId", "period", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_personId_period_scope_periodStart_key" ON "Assessment"("personId", "period", "scope", "periodStart");

-- CreateIndex
CREATE INDEX "Summary_personId_period_periodStart_idx" ON "Summary"("personId", "period", "periodStart");

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Summary" ADD CONSTRAINT "Summary_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
