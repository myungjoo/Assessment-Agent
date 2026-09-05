-- T-1863 (ADR-0062 §Decision 2 / §Follow-ups T-1863) — LlmDefaultProvider 단일 슬롯 table 도입 migration.
-- "전역 기본 LLM provider" 를 LlmProviderConfig 의 isDefault Boolean 컬럼이 아니라 고정 id 1 row 만
-- 사는 별도 table 로 표현한다 (ADR-0062 §Alternatives B 미채택 — partial unique index 의 raw SQL /
-- schema drift 회피). 1 table + 1 unique index + 1 FK 만 추가하고 기존 table 의 ALTER / DROP / UPDATE
-- 문은 0 이다 — additive only (20260830000000_collection_target 선례 형식).
--
-- **기존 row 자동 승격 없음 (ADR-0062 §Decision 1 제약 1 "명시 선택 최우선")** — 본 migration 은 빈
-- table 을 만들 뿐이며 기존 LlmProviderConfig row 를 슬롯으로 INSERT 하는 data migration 이 0 이다.
-- 따라서 배포 직후 상태는 "기본 지정 없음" 이고, 그 상태의 default 경로는 resolver 의 하위 호환 분기
-- (row 1 개면 그 row / row 0 개 · row ≥ 2 개면 fail-fast — T-1864) 가 그대로 처리한다.

-- CreateTable: LlmDefaultProvider — ADR-0062 §Decision 2 코드 블록 1:1. id 의 DEFAULT 'default' 는
-- 고정 슬롯 리터럴로, PK 자체가 "슬롯은 1 개" 를 표현한다 (CHECK 제약 · partial index 불요 —
-- 잉여 row 가 생겨도 읽기 경로가 id = 'default' 단건 조회뿐이라 무해하게 무시된다).
CREATE TABLE "LlmDefaultProvider" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "llmProviderConfigId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LlmDefaultProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: 한 LlmProviderConfig 가 슬롯을 두 번 차지할 수 없다 (ADR-0062 §Decision 2).
-- 단일 row 전제에서는 중복 제약이지만 index 1 개 비용으로 그 불변식을 DB 레벨에 남긴다.
CREATE UNIQUE INDEX "LlmDefaultProvider_llmProviderConfigId_key" ON "LlmDefaultProvider"("llmProviderConfigId");

-- AddForeignKey: ON DELETE RESTRICT — 기본으로 지정된 config 의 삭제를 DB 가 차단한다
-- (ADR-0062 §Decision 1 제약 4). LlmProviderConfigService.delete 의 기존 P2003 → 409 변환이
-- 그대로 재사용되므로 service 쪽 새 분기는 0 이다 (메시지 확장만 T-1864 소관).
-- DifficultyMapping → LlmProviderConfig FK 와 동형 (ADR-0011 §2).
ALTER TABLE "LlmDefaultProvider" ADD CONSTRAINT "LlmDefaultProvider_llmProviderConfigId_fkey" FOREIGN KEY ("llmProviderConfigId") REFERENCES "LlmProviderConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
