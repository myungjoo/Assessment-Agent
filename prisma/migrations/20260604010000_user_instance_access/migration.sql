-- CreateTable
CREATE TABLE "UserInstanceAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instanceRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInstanceAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserInstanceAccess_userId_idx" ON "UserInstanceAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInstanceAccess_userId_instanceRef_key" ON "UserInstanceAccess"("userId", "instanceRef");

-- AddForeignKey
ALTER TABLE "UserInstanceAccess" ADD CONSTRAINT "UserInstanceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
