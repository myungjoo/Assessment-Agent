-- T-0485 (ADR-0044 Decision §1) — ExportJob / ImportJob 영속 entity 도입 migration.
-- 본 migration 은 export/import 비동기 진행 추적·재시도·감사 backbone 의 schema 박제.
-- 2 enum (ExportScope / ImportMode) + 1 공통 enum (JobStatus) + 2 table (ExportJob /
-- ImportJob) + 2 FK (requestedById → User.id, onDelete RESTRICT) + 2 index
-- (@@index([status, createdAt])) 추가. 기존 table ALTER 0 — additive only.
-- ADR-0044 Decision §1 (필드 박제) / §2 (raw 미저장 전파) / §4 (재시도 정책) 정합.

-- CreateEnum: JobStatus (ExportJob / ImportJob 공통, ADR-0044 §1).
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum: ExportScope (ExportJob 고유, ADR-0044 §1 / UC-07 §6.1).
CREATE TYPE "ExportScope" AS ENUM ('FULL', 'RANGE', 'PARTIAL');

-- CreateEnum: ImportMode (ImportJob 고유, ADR-0044 §1 / UC-07 §6.2).
CREATE TYPE "ImportMode" AS ENUM ('REPLACE', 'MERGE');

-- CreateTable: ExportJob — UC-07 §8 NFR 의 async job 진행 추적 backbone (read-only).
-- raw 미저장 invariant (ADR-0044 §2): artifactRef 는 참조 식별자, error 는 사람-친화
-- 요약. raw commit body / diff / page 본문 컬럼 0 — schema-level 강제.
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "scope" "ExportScope" NOT NULL,
    "dateRange" JSONB,
    "entitySelector" JSONB,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "artifactRef" TEXT,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ImportJob — UC-07 §1 invariant b (Import atomic transaction)
-- + ADR-0044 §3 (ADR-0033 reset-and-recreate 동형 single $transaction all-or-nothing).
-- raw 미저장 invariant (ADR-0044 §2) 정합 — ExportJob 와 동형 컬럼.
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ImportMode" NOT NULL DEFAULT 'REPLACE',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "artifactRef" TEXT,
    "restoredRowCount" INTEGER,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: status polling + 감사 조회 leading-edge (ADR-0044 §1, UC-07 §8).
-- Assessment 의 시계열 @@index 동형 패턴 — "현재 RUNNING 의 최근 순" / "FAILED 의
-- 기간별 감사" 의 leading-edge 필터 + 시계열 정렬 cover.
CREATE INDEX "ExportJob_status_createdAt_idx" ON "ExportJob"("status", "createdAt");

-- CreateIndex: ImportJob status polling + 감사 조회 leading-edge (ExportJob 정합).
CREATE INDEX "ImportJob_status_createdAt_idx" ON "ImportJob"("status", "createdAt");

-- AddForeignKey: ExportJob.requestedById → User.id (ADR-0044 §1 requestedBy).
-- onDelete RESTRICT — User hard delete 시 dangling job row 차단 (DifficultyMapping →
-- LlmProviderConfig Restrict 패턴 정합). 운영자가 User 삭제 전 관련 job row 정리 책임.
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: ImportJob.requestedById → User.id (ExportJob 정합).
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
