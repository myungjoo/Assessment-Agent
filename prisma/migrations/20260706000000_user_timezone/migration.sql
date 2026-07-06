-- T-0799 (ADR-0052 Decision (a)) — User.timezone 컬럼 additive migration.
-- per-user timezone 설정의 저장 위치를 로그인 계정 User 엔티티의 timezone 컬럼
-- (IANA tz 식별자 문자열, 예: 'Asia/Seoul') 으로 확정 (ADR-0052 §Decision (a)).
-- additive / 무손상 — NOT NULL + DEFAULT 'Asia/Seoul' 이라 기존 User row 는
-- migration 시 KST 로 자동 backfill 되고 신규 User 도 미지정 시 KST 다. 기존
-- 컬럼/관계(email @unique · instanceAccess · exportJobs · importJobs) 무접촉.
-- 요약/평가 기간 경계는 본 컬럼 영향 밖 — KST 기본 유지 (ADR-0052 Decision (c)).

-- AlterTable: User 에 timezone 컬럼 1개 추가 (additive, 기존 row default backfill).
ALTER TABLE "User" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul';
