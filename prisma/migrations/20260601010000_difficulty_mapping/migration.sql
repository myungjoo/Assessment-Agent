-- CreateTable
CREATE TABLE "DifficultyMapping" (
    "id" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "llmProviderConfigId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DifficultyMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DifficultyMapping_difficulty_key" ON "DifficultyMapping"("difficulty");

-- AddForeignKey
ALTER TABLE "DifficultyMapping" ADD CONSTRAINT "DifficultyMapping_llmProviderConfigId_fkey" FOREIGN KEY ("llmProviderConfigId") REFERENCES "LlmProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
