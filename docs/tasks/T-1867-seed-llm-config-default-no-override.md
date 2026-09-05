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
estimatedDiff: 200
estimatedFiles: 4
created: 2026-09-03
requeuedAt: 2026-09-05T11:01:49Z
plannerNote: "오너 지시 2026-09-03 chain 6/7 — 웹 쓰기 축 B4(T-1902) 머지로 남은 구현 조각. ADR-0062 택1(슬롯 table) 반영해 재큐잉"
---

# T-1867 — seed-llm-config.sh — 명시 기본 provider 를 절대 덮어쓰지 않는 bootstrap-only default

## Why

오너 지시 (2026-09-03, [PLAN.md](../PLAN.md) `107 행`) "Admin 이 Web UI 에서 지정한 기본 provider 가 어떤 자동 규칙보다 언제나 우선" 의 가장 큰 위협은 [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 다 — [redeploy.sh](../../deploy/redeploy.sh) 가 재배포마다 호출하고 고정 id row 를 `ON CONFLICT DO UPDATE` 로 덮어쓴다. [ADR-0062](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) 제약 ⑤ 는 seed 의 default 개입을 "명시 선택이 하나도 없을 때 1 회 bootstrap" 으로만 한정한다. 본 slice 가 그 조문을 SQL 로 옮긴다. chain 7 조각 중 마지막 구현 조각이며, 뒤에는 direct doc-sync ([T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md)) 만 남는다.

**issue-still-relevant pre-check (origin/main `903452df`, 2026-09-05 11:01Z)** — 본 task 는 2026-09-03 생성분의 **재큐잉**이며 신규 duplicate 를 만들지 않았다 (cron-race superseded-PR 안티패턴 회피).

- `git grep -c -i "default" origin/main -- deploy/seed-llm-config.sh` → **0 매치**. seed 측 no-override 로직은 main 에 아직 없다 → 본 task 는 여전히 유효.
- `git grep -n "model LlmDefaultProvider" origin/main -- prisma/schema.prisma` → `484 행` 실재. T-1863 이 머지돼 **저장 형태 택1 이 확정**됐다 — 따라서 생성 시점에 남겨뒀던 (i) `isDefault` 컬럼 / (ii) 슬롯 table 택1 모호를 **(ii) 슬롯 table `LlmDefaultProvider` 로 확정**해 아래 AC 에서 제거했다.
- `git ls-tree origin/main prisma/migrations/20260903000000_llm_default_provider/` → 실재. 컬럼은 `id`(PK, `DEFAULT 'default'`) · `llmProviderConfigId`(UNIQUE, FK `ON DELETE RESTRICT`) · `createdAt` · `updatedAt`.
- 선행 의존 T-1863 은 머지 완료, 다른 BLOCKED 선행 없음 → 즉시 착수 가능.

## Required Reading

- [docs/decisions/ADR-0062-llm-default-provider-explicit-selection.md](../decisions/ADR-0062-llm-default-provider-explicit-selection.md) — §Decision 1 제약 ⑤ (seed 는 명시 선택을 덮어쓰지 않는다) + §Decision 2 (단일 슬롯 table).
- [prisma/migrations/20260903000000_llm_default_provider/migration.sql](../../prisma/migrations/20260903000000_llm_default_provider/migration.sql) 전체 (약 `35 행`) — table · 컬럼 · unique index · FK 의 **정확한 이름**.
- [deploy/seed-llm-config.sh](../../deploy/seed-llm-config.sh) 전체 (`116 행`) — 특히 `98~113 행` 의 `psql` heredoc upsert 와 `1~30 행` 설계 주석.
- [deploy/README.md](../../deploy/README.md) `§5.2` seed 운영 절차 단락 — default 정책 한국어 1~3 줄 추가 지점.
- [deploy/env.prod.example](../../deploy/env.prod.example) 의 `SEED_LLM_*` 주석 블록 — 새 env 키는 **추가하지 않고** 주석 1~2 줄만.
- [test/smoke/realdata-e2e-seed-llm-config-env-gating-...-contract.smoke-spec.ts](../../test/smoke/realdata-e2e-seed-llm-config-env-gating-no-op-guard-strict-mode-env-override-defaults-enckey-failfast-stdin-secret-safe-bounded-readiness-contract.smoke-spec.ts) `1~80 행` (계약 mirror 방식 주석) — 본 slice 의 새 계약 assert 가 붙을 spec.
- [test/smoke/realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts](../../test/smoke/realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts) `110~140 행` — **읽기만 (수정 금지)**. `extractInsertColumns` 는 `INSERT INTO "LlmProviderConfig"` 로 table-scoped 이고 `extractOnConflictColumns` 는 `DO UPDATE SET` 첫 매치를 취한다 → 새 문장을 **기존 upsert 뒤에 `DO NOTHING` 으로** 붙이면 이 추출기가 드리프트하지 않는다 (아래 AC 의 문장 순서 제약 근거).

## Acceptance Criteria

- [ ] `deploy/seed-llm-config.sh` 의 기존 `LlmProviderConfig` upsert **뒤에** 조건부 슬롯 bootstrap SQL 추가 — `INSERT INTO "LlmDefaultProvider" ("id","llmProviderConfigId","createdAt","updatedAt") VALUES ('default','$ID_E', NOW(), NOW()) ON CONFLICT ("id") DO NOTHING;`. 기존 명시 선택이 있으면 **no-op**, `DO UPDATE` 사용 금지, 기존 upsert 의 5-컬럼 update 집합은 무변경.
- [ ] 문장 순서 제약 유지 — 파일 안 첫 `ON CONFLICT (...) DO UPDATE SET` 은 여전히 `LlmProviderConfig` upsert 여야 한다 (T-0794 parity spec 의 추출기 계약). `pnpm test:smoke` 로 해당 spec 무수정 통과 확인.
- [ ] 스크립트 설계 주석 (`1~30 행`) · `deploy/README.md §5.2` · `env.prod.example` 의 `SEED_LLM_*` 블록에 한국어 1~3 줄: "seed 는 기본 provider 를 최초 1 회만 지정하며 Admin UI 의 명시 선택을 덮어쓰지 않는다".
- [ ] **happy-path 1+** — env-gating smoke spec 에 새 describe 추가: 실 shell 을 `readFileSync` 로 읽어 `INSERT INTO "LlmDefaultProvider"` + `ON CONFLICT ("id") DO NOTHING` 구문 실재와 슬롯 id 리터럴 `'default'` 를 assert.
- [ ] **error path / negative 1+ 씩, 예외 분기마다** — (a) 새 문장에 `DO UPDATE` 가 없음 (no-override 회귀 방지), (b) 기존 `LlmProviderConfig` upsert 의 update 집합에 default 관련 컬럼이 섞이지 않음, (c) 합성 mutant (`DO NOTHING` → `DO UPDATE SET` 로 바꾼 사본) 에 대해 판정이 **false** 로 뒤집혀 silent PASS 가 아님을 입증, (d) 새 문장이 기존 upsert **앞**에 온 합성 사본에서 순서 계약 판정이 false.
- [ ] **분기별 1+** — 추출 helper 를 추가한다면 "매치 없음 → null" 분기까지 케이스 1+ (기존 spec 의 추출기 관례 그대로).
- [ ] `bash -n deploy/seed-llm-config.sh` 통과.
- [ ] `pnpm lint && pnpm build && pnpm test && pnpm test:smoke` 통과. production TypeScript 변경이 0 이므로 `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% threshold 도 그대로 통과해야 한다.
- [ ] credential 실값 0 (§9 / REQ-059) — spec·문서·스크립트 어디에도 실 키를 적지 않는다.

## Out of Scope

- `test/smoke/realdata-e2e-seed-llm-config-sql-cipher-contract-schema-parity-drift.smoke-spec.ts` 수정 — 추출기가 table-scoped 라 드리프트가 없다. 실제로 red 가 나면 그때 같은 PR 에서 최소 수정하고 파일 수 5 를 넘기지 않는다.
- seed 가 기본 지정을 **해제** 하거나 다른 row 로 옮기는 경로 (명시 선택 원칙상 없음).
- `deploy/redeploy.sh` 변경, 실 LAN 기기 재배포 실행 (사람 runbook).
- `docs/requirements.md` · `docs/PLAN.md` · ADR status 재판정 — [T-1868](T-1868-llm-default-provider-doc-sync-req-plan-adr.md) (direct) 소관.

## Suggested Sub-agents

`implementer → tester` (→ driver 가 integrator).

## Follow-ups

- 다음 daily-deploy-test fire 에서 "seed row + UI row 공존 + UI 기본 지정 → 재배포 → 선택 유지" 를 사람이 1 회 확인 (journal 1 줄).
- `LlmDefaultProvider` 의 INSERT 컬럼 튜플 ↔ Prisma scalar 컬럼 parity 는 현재 T-0794 guard 범위 밖 — 필요 시 별도 slice.
