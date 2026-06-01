-- CreateTable
CREATE TABLE "LlmProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmProviderConfig_pkey" PRIMARY KEY ("id")
);
