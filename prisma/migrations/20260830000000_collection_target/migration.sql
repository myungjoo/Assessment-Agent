-- T-1808 (ADR-0059 §Decision 4 / §Follow-ups (a)) — CollectionTarget table 도입 migration.
-- 운영자가 등록·편집하는 평가 대상 시스템(수집 대상) 좌표의 정본 table 을 신설한다.
-- 1 table + 1 unique index 만 추가하고 기존 table 의 ALTER / DROP / UPDATE 문은 0 이다 —
-- additive only (T-0485 선례 형식). 신규 table 이라 생성 직후 0 row 에서 시작하므로 기존
-- row 를 읽거나 옮기는 data migration 도 0 (ADR-0059 §Decision 6 판정의 실측 재확인).
-- credential 컬럼 0 (§Decision 2) — token / tokenEnc / secret / password / apiKey 계열을
-- 정의하지 않고 "instanceKey" 참조만 보유한다 (실제 credential 은 env 에 남는다).

-- CreateTable: CollectionTarget — §Decision 4 필드 표 1:1. type 은 enum 이 아니라 TEXT
-- ("GITHUB" | "CONFLUENCE" 강제는 후속 DTO @IsIn 소관). 다중 값 컬럼은 PostgreSQL native
-- array (TEXT[]) + 빈 배열 default — 미지정 시에도 NULL 이 아니라 빈 목록이다.
CREATE TABLE "CollectionTarget" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "instanceKey" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "orgs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "repos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "spaces" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: 한 종류 안에서 instance key 유일 (§Decision 4). endpoint 단독 unique 는
-- 두지 않는다 — 같은 host 에 서로 다른 org 집합 등록이 정당한 사용이기 때문.
CREATE UNIQUE INDEX "CollectionTarget_type_instanceKey_key" ON "CollectionTarget"("type", "instanceKey");
