---
id: T-1867
title: seed-llm-config.sh — 명시 기본 provider 를 절대 덮어쓰지 않는 bootstrap-only default
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-049, REQ-051]
independentStream: llm-default-provider
dependsOn: [T-1863]
touchesFiles:
  - deploy/seed-llm-config.sh
  - deploy/README.md
  - deploy/env.prod.example
  - test/smoke/realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts
estimatedDiff: 180
estimatedFiles: 4
created: 2026-09-03
plannerNote: "오너 지시 2026-09-03 chain 6/7 — '명시 선택이 언제나 우선' 의 seed 측 집행. T-1863 schema 만 있으면 되므로 T-1864~T-1866 과 파일-disjoint · 동시 claim 가능"
---

# T-1867 — seed-llm-config.sh — 명시 기본 provider 를 절대 덮어쓰지 않는 bootstrap-only default

## Why

오너 지시 (2026-09-03) "사용자가 명시적으로 선택한 것이 언제나 우선" 의 가장 큰 위협은 [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 다 — [redeploy.sh](../../deploy/redeploy.sh) 가 재배포마다 호출하고 고정 id row 를 `ON CONFLICT DO UPDATE` 로 통째로 덮어쓴다. [ADR-0062](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) (5) 는 seed 의 default 개입을 "명시 선택이 하나도 없을 때 자기 row 를 기본으로 지정" 으로만 한정한다. 본 slice 가 그 조문을 SQL 로 옮긴다.

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — (1) · (5) 와 (A) 택1 결과 (isDefault 컬럼 vs 슬롯 table — SQL 이 달라진다).
- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 전체 (약 120 행) — `97~116 행` upsert SQL, `1~30 행` 설계 주석 (본 slice 가 주석에 default 정책 단락 추가).
- [prisma/migrations/20260903000000_llm_default_provider/migration.sql](../../prisma/migrations/20260903000000_llm_default_provider/migration.sql) — T-1863 의 실제 컬럼 / table / index 이름.
- [deploy/README.md](../../deploy/README.md) `§5.2` (`170~220 행` 부근) — seed 운영 절차. default 정책 단락 추가.
- [deploy/env.prod.example](../../deploy/env.prod.example) `30~38 행` — `SEED_LLM_*` 주석 블록. 새 env 는 없고 주석 1~2 줄만.
- 위 smoke spec — seed 스크립트 본문을 문자열 계약으로 검사하는 방식 (`env-override-defaults` 축). 새 계약 assert 추가.

## Acceptance Criteria

- [ ] upsert 뒤에 **조건부 default 지정 SQL** 추가 — 택1 (i): `UPDATE "LlmProviderConfig" SET "isDefault" = true WHERE "id" = '<seed id>' AND NOT EXISTS (SELECT 1 FROM "LlmProviderConfig" WHERE "isDefault")`; 택1 (ii): `INSERT INTO <슬롯 table> … ON CONFLICT ("id") DO NOTHING`. 어느 쪽이든 **기존 명시 선택이 있으면 no-op** 이고, seed row 자체의 다른 컬럼 upsert 는 종전과 동일.
- [ ] 명시 선택이 seed row 가 아닌 다른 row 를 가리키는 상태에서 재배포해도 그 선택이 유지됨을 spec 이 SQL 문자열 계약으로 고정 (`DO NOTHING` 또는 `NOT EXISTS` 구문 존재 + `DO UPDATE` 절에 default 컬럼이 **없음**).
- [ ] 스크립트 주석 (`1~30 행` 설계 단락) + `deploy/README.md §5.2` + `env.prod.example` `SEED_LLM_*` 블록에 한국어 1~3 줄: "seed 는 기본 provider 를 최초 1 회만 지정하며 Admin UI 의 선택을 덮어쓰지 않는다".
- [ ] smoke spec — happy 1+ (새 계약 구문 실재), negative 1+ (`DO UPDATE SET` 절이 default 컬럼 / 슬롯을 갱신하지 않음 — 회귀 방지), 기존 no-op guard / strict mode / enckey fail-fast 계약 무변경 통과.
- [ ] `bash -n deploy/seed-llm-config.sh` 통과. `pnpm lint && pnpm build && pnpm test && pnpm test:smoke` 통과.

## Out of Scope

- seed 가 default 를 **해제** 하는 경로 (없음 — 명시 원칙).
- 실 LAN 기기 재배포 실행 — 사람 runbook. 본 slice 는 스크립트 + 계약 spec 까지.
- redeploy.sh 변경.

## Suggested Sub-agents

- implementer → tester → integrator.

## Follow-ups

- 다음 daily-deploy-test fire 에서 "seed row + UI row 공존 + UI 기본 지정 → 재배포 → 선택 유지" 를 사람이 1 회 확인 (journal 1 줄).
