---
id: T-1361
title: requirements.md 42~44 행 REQ-023~025 서비스 ID 매핑 상태를 실측 기반 DONE 으로 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-023, REQ-024, REQ-025]
estimatedDiff: 14
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1361-requirements-service-identity-status-rejudge.md
plannerNote: "requirements-status-resync 7 번째 slice — 단일 model ServiceIdentity + service-identity.repository 가 셋을 함께 cover 하는 동형 3 row 묶음"
---

# T-1361 — requirements.md 42~44 행 REQ-023~025 서비스 ID 매핑 상태를 실측 기반 DONE 으로 재판정

## Why

[PLAN.md](../PLAN.md) **53 · 54 행**이 "서비스별 ID 매핑 … 일부 NULL 허용(R-48)" 과 "Primary key 역할 ID 지정(R-47)" 을 각각 `[x] implemented-on-main` 으로 박제했는데, [requirements.md](../requirements.md) **42~44 행**의 REQ-023 · REQ-024 · REQ-025 는 여전히 `PLANNED` 다 — T-1355 ~ T-1360 이 여섯 번 닫아온 **문서 자기 모순**과 동형이다. 구현도 `model ServiceIdentity` 하나(+ `service-identity.repository.ts`)가 세 REQ 를 함께 cover 한다: N 매핑(`@@unique([personId, service])`) · primary 표식(`isPrimary` + `setPrimary` 트랜잭션) · NULL 허용(미등록 서비스 = row 부재)이 같은 model 의 세 측면이라 **판정 근거가 완전히 동형인 3 row 묶음**이다. `requirements-status-resync` stream 의 일곱 번째 slice — 전 row 일괄 flip 은 근거가 row 마다 달라 불가하므로 본 slice 도 3 row 만 다룬다.

## Required Reading

- [docs/requirements.md](../requirements.md) — 42 · 43 · 44 행 (REQ-023 · REQ-024 · REQ-025) + 8 행부터의 상태 enum 설명
- [docs/PLAN.md](../PLAN.md) — 53 · 54 행 (서비스별 ID 매핑 / Primary key 역할 ID 지정 bullet)
- [prisma/schema.prisma](../../prisma/schema.prisma) — `model Person`(55 행 부근 `serviceIdentities` 관계) + `model ServiceIdentity`(257 행 부근)
- [src/user/service-identity.repository.ts](../../src/user/service-identity.repository.ts) — `findByPersonId` / `create` / `setPrimary` / `remove`
- [docs/tasks/T-1359-requirements-github-instance-status-rejudge.md](T-1359-requirements-github-instance-status-rejudge.md) — 같은 stream 직전 slice 의 편집 형식(상태 컬럼 1 개만 치환 + 한계 부기)

## Acceptance Criteria

- [ ] **실측 선행** — 아래 6 항목을 먼저 grep 으로 확인하고 결과 수치를 commit body 에 남긴다. 기대치와 어긋나면 **문서를 실측에 맞춘다**(반대 금지, 날조 금지).
  - `grep -n "model ServiceIdentity" prisma/schema.prisma` → **1 hit**
  - `grep -n "@@unique(\[personId, service\])" prisma/schema.prisma` → **1 hit** (서비스당 1 매핑 invariant)
  - `grep -n "isPrimary" prisma/schema.prisma` → **1 hit** (`Boolean @default(false)`)
  - `grep -n "setPrimary" src/user/service-identity.repository.ts` → **1 hit** (`$transaction` 으로 updateMany(false) → update(true))
  - `ls src/user/service-identity.*` → 구현 1 + colocated spec 1 (**service/controller 는 부재**)
  - `grep -n "^- \[x\] \*\*서비스별 ID 매핑\|^- \[x\] \*\*Primary key" docs/PLAN.md` → **2 hit** (53 · 54 행)
- [ ] [docs/requirements.md](../requirements.md) **42 행 REQ-023** 의 **상태 컬럼 1 개**를 `PLANNED` → `DONE (...)` 으로 치환. 근거는 `model ServiceIdentity` 의 1 Person ↔ N `service`/`externalId` 매핑 + `@@unique([personId, service])`, 검증은 `service-identity.repository.spec.ts`(검증 위치 `unit` 과 정합).
- [ ] **43 행 REQ-024** 의 상태 컬럼 1 개를 `DONE (...)` 으로 치환. 근거는 `ServiceIdentity.isPrimary` + `setPrimary` 트랜잭션(1 Person 당 정확히 1 primary 강제). **한계 부기 의무** — 본 row 의 검증 위치가 `policy + unit` 이고 kind 가 `ADR 필수` Constraint 인데 **전용 ADR 이 없고 [ADR-0002](../decisions/ADR-0002-db.md) 에 귀속**돼 있으며 **HTTP 노출(service/controller) 미보유** 이므로, 상태 문자열에 그 한계를 그대로 적는다(T-1357 의 `e2e 미보유` 부기 선례 동형 — 과장 금지).
- [ ] **44 행 REQ-025** 의 상태 컬럼 1 개를 `DONE (...)` 으로 치환. 근거는 "미등록 서비스는 row 부재로 NULL 표현"(nullable 컬럼이 아니라 관계 부재로 표현한다는 설계 사실을 명시).
- [ ] **구조 무손상 검증** — 편집 후 `wc -l docs/requirements.md` = **97**, `grep -c "^| REQ-" docs/requirements.md` = **66**, 42 · 43 · 44 행의 `|` 개수 각 **8** 이 모두 불변.
- [ ] **잔여 카운트 정직성** — 편집 후 `grep -c PLANNED docs/requirements.md` 가 **34 → 31** (REQ row 기준 32 → 29). 이 수치를 commit body 에 남긴다.
- [ ] 세 row 의 **나머지 6 컬럼**(REQ / README 행 / 요약 / kind / 구현 위치 / 검증 위치)과 **다른 63 row** 는 무수정.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` 코드 변경 일절 금지 — 본 task 는 문서 상태 재판정 only.
- REQ-024 의 전용 ADR 신설 · `ServiceIdentityService` / controller 신설 — 본 task 는 **현 상태를 정직하게 기술**할 뿐, 결핍을 메우지 않는다(필요 시 Follow-ups 로).
- [PLAN.md](../PLAN.md) · [modules.md](../architecture/modules.md) · [STATE.json](../STATE.json) · journal 수정 금지 (journal · STATE 는 driver 책임).
- 나머지 29 개 `PLANNED` row 의 일괄 flip 금지 — 판정 근거가 row 마다 달라 slice 를 넘기면 날조 위험.
- 상태 enum 정의(8~9 행) · 표 헤더 · 96 행 planner 운용 note 수정 금지.

## Suggested Sub-agents

`implementer` (doc-only 편집 — 실측 grep 선행 후 상태 컬럼 3 개 치환). doc-only 라 R-110 tester 면제 — 대신 위 실측 grep + 구조 self-check 로 대체한다.

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 추가)
