---
id: T-1362
title: requirements.md 45 · 47 행 REQ-026 · REQ-028 인원/그룹 관리 상태를 실측 기반 재판정
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-026, REQ-028]
estimatedDiff: 12
estimatedFiles: 2
created: 2026-08-01
independentStream: requirements-status-resync
dependsOn: []
touchesFiles:
  - docs/requirements.md
  - docs/tasks/T-1362-requirements-person-group-status-rejudge.md
plannerNote: "requirements-status-resync 8 번째 slice — src/user 인원·그룹 CRUD 축 2 row, PLAN 53·56 행 implemented-on-main 과의 모순 해소"
---

# T-1362 — requirements.md 45 · 47 행 REQ-026 · REQ-028 인원/그룹 관리 상태를 실측 기반 재판정

## Why

[PLAN.md](../PLAN.md) **53 행**("평가 대상 인원 관리 — CRUD, group, deactivate/activate")과 **56 행**("Group 정책 — 다중 group 소속 + 조직도 파트 1 개")이 이미 `[x] implemented-on-main` 으로 박제됐는데, [requirements.md](../requirements.md) **45 행 REQ-026** 과 **47 행 REQ-028** 은 여전히 `PLANNED` 다 — T-1355 ~ T-1361 이 일곱 번 닫아온 **문서 자기 모순**과 동형이다. 두 row 는 근거 수집 범위가 같은 `src/user` 인원·그룹 관리 축(`person.*` + `group.*` + `person-group-membership.*` + `part.*` + 대응 e2e spec)에 모여 있어 한 slice 로 묶을 수 있다. `requirements-status-resync` stream 의 여덟 번째 slice — 잔여 row 일괄 flip 은 근거가 row 마다 달라 금지이므로 본 slice 도 2 row 만 다룬다.

## Required Reading

- [docs/requirements.md](../requirements.md) — 45 행(REQ-026) · 47 행(REQ-028) + 9 행의 상태 enum 정의
- [docs/PLAN.md](../PLAN.md) — 53 행(인원 관리 bullet) · 56 행(Group 정책 bullet)
- [src/user/person.service.ts](../../src/user/person.service.ts) — CRUD 5 메서드 + `deactivate` / `reactivate` + 84 · 115 행 주석(HTTP 노출 범위에 대한 기존 박제)
- [src/user/person.controller.ts](../../src/user/person.controller.ts) — 53 · 60 · 68 · 81 · 91 행 5 endpoint
- [prisma/schema.prisma](../../prisma/schema.prisma) — 23~26 행 주석(`Person.partId` nullable 유지 근거) + `model PersonGroupMembership`(131 행 부근, `@@unique([personId, groupId])`)
- [docs/tasks/T-1361-requirements-service-identity-status-rejudge.md](T-1361-requirements-service-identity-status-rejudge.md) — 같은 stream 직전 slice 의 편집 형식(상태 컬럼만 치환 + 한계 부기 + 실측값 채택 원칙)

## Acceptance Criteria

- [ ] **실측 선행** — 아래 7 항목을 먼저 grep/ls 로 확인하고 결과 수치를 commit body 에 남긴다. 기대치와 어긋나면 **문서를 실측에 맞춘다**(반대 금지, 날조 금지 — 주석 hit 포함으로 수치가 커지면 실측값 채택).
  - `grep -nE "@(Get|Post|Patch|Delete)\(" src/user/person.controller.ts` → **5 endpoint**
  - `grep -n "async deactivate\|async reactivate" src/user/person.service.ts` → **2 hit**
  - `ls test/e2e/persons.e2e-spec.ts test/e2e/groups.e2e-spec.ts` → **2 파일 존재** (+ 각 파일 `grep -c "it("` 수치 기록)
  - `grep -n "@@unique(\[personId, groupId\])" prisma/schema.prisma` → **1 선언** (다중 group 소속 + 중복 소속 금지)
  - `grep -n "partId String?" prisma/schema.prisma` → **1 hit** (조직도 파트 FK 가 **nullable**)
  - `ls src/user/part.service.ts src/user/group.service.ts src/user/person-group-membership.repository.ts` → **3 파일 존재**
  - `grep -n "^- \[x\] 평가 대상 인원 관리\|^- \[x\] \*\*Group 정책" docs/PLAN.md` → **2 hit** (행 번호는 실측값 기록)
- [ ] [docs/requirements.md](../requirements.md) **45 행 REQ-026** 의 **상태 컬럼 1 개**를 `PLANNED` → `DONE (...)` 으로 치환. 근거는 `PersonService` CRUD + `deactivate`/`reactivate`(휴직 숨김) 를 `PersonController` 5 endpoint 가 forward + `persons.e2e-spec.ts`(검증 위치 `unit + e2e` 와 정합). **한계 부기 의무** — 전용 `POST /:id/deactivate` endpoint 가 없고 활성 토글이 `PATCH :id` 경유라면 그 사실을 상태 문자열에 그대로 적는다(실측으로 확인, 과장 금지).
- [ ] **47 행 REQ-028** 의 상태 컬럼 1 개를 `DONE (...)` 으로 치환. 근거는 `PersonGroupMembership` 중간 테이블(`@@unique([personId, groupId])`)의 N:M 다중 group 소속 + `Person.partId` 단일 FK 의 조직도 파트 1 개. **한계 부기 의무** — `partId` 가 **nullable** 이라 "정확히 1 파트" invariant 가 DB 제약이 아니라는 사실(schema 23~26 행 주석의 박제)을 상태 문자열에 명시한다.
- [ ] **구조 무손상 검증** — 편집 후 `wc -l docs/requirements.md` · `grep -c "^| REQ-" docs/requirements.md` = **66** 이 불변이고, 45 · 47 행의 `|` 개수가 각각 편집 전과 동일(**8**)함을 확인.
- [ ] **잔여 카운트 정직성** — 편집 후 `grep -c PLANNED docs/requirements.md` 가 **31 → 29** (REQ row 기준 29 → 27). 이 수치를 commit body 에 남긴다.
- [ ] 두 row 의 **나머지 6 컬럼**(REQ / README 행 / 요약 / kind / 구현 위치 / 검증 위치)과 **다른 64 row** 는 무수정.

## Out of Scope

- `src/` · `web/` · `test/` · `prisma/` 코드 변경 일절 금지 — 본 task 는 문서 상태 재판정 only.
- REQ-026 의 dedicated deactivate/reactivate endpoint 신설 · REQ-028 의 `partId` NOT NULL 전환 / service-layer invariant 강제 — 본 task 는 **현 상태를 정직하게 기술**할 뿐 결핍을 메우지 않는다(필요 시 Follow-ups 로).
- [PLAN.md](../PLAN.md) · [modules.md](../architecture/modules.md) · [STATE.json](../STATE.json) · journal 수정 금지 (journal · STATE 는 driver 책임).
- 나머지 27 개 `PLANNED` REQ row 의 일괄 flip 금지 — 판정 근거가 row 마다 달라 slice 를 넘기면 날조 위험.
- 상태 enum 정의(9 행) · 표 헤더 · 96 행 planner 운용 note 수정 금지.

## Suggested Sub-agents

`implementer` (doc-only 편집 — 실측 grep 선행 후 상태 컬럼 2 개 치환). doc-only 라 R-110 tester 면제 — 대신 위 실측 grep + 구조 self-check 로 대체한다.

## Follow-ups

- **다음 slice 후보: REQ-029 (48 행, 평가 자료 non-volatile 저장) + REQ-032 (51 행, raw data 저장 금지).** 둘 다 P3 저장 정책 축이라 근거(`prisma/schema.prisma` + 관련 ADR)가 겹친다 — 단 REQ-032 는 `ADR 필수` Constraint 라 ADR 존재 여부 실측이 선행돼야 한다.
- **REQ-028 의 결핍 1 종** — `Person.partId` nullable 로 인한 "정확히 1 파트" 미강제(schema 23~26 행이 후속 service-layer 책임으로 defer). 강제 도입은 별도 task 후보이며 data migration 을 동반하므로 CLAUDE.md §5 BLOCKED 대상 검토 필요.
- **잔여 `PLANNED` 27 개 REQ row** — 상태 stale 해소는 계속 slice 단위로.
