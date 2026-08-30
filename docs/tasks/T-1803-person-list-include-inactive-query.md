---
id: T-1803
title: GET /api/persons 에 includeInactive query 축 추가 (휴직 인원 조회 경로 개통)
phase: P6
status: DONE
commitMode: pr
coversReq: [REQ-071]
estimatedDiff: 165
estimatedFiles: 2
created: 2026-08-30
independentStream: person-activate-ui
dependsOn: []
touchesFiles:
  - src/user/person.controller.ts
  - src/user/person.controller.spec.ts
plannerNote: P6 오너 지시 130 행 REQ-071 잔여 Activate 진입점의 선행 backend 축 — 휴직 인원 조회 query 1 개 개통
---

# T-1803 — GET /api/persons 에 includeInactive query 축 추가 (휴직 인원 조회 경로 개통)

## Why

오너 지시 [PLAN](../PLAN.md) `130 행` (평가 대상 추가·편집 인터페이스, R-164~R-168) 의 인원 축은 [T-1802](T-1802-requirements-req071-person-crud-rejudge.md) 재판정으로 5 동작 중 4 개(추가 · 삭제 · 변경 · Deactivate)만 shipped 이고, 잔여는 **Activate(재활성) 진입점 1 건** 이다 ([requirements.md](../requirements.md) `90 행` REQ-071 `IN_PROGRESS`).

그 잔여의 근본 원인은 UI 가 아니라 **조회 계약** 이다 — `GET /api/persons` 가 [person.service.ts](../../src/user/person.service.ts) `85 행` 근처 `findActive()` 로 활성 인원만 반환하므로, 휴직 처리한 인원은 목록에서 사라져 화면에서 되돌릴 대상 자체를 고를 수 없다. service layer 에는 `findAll()`(`activeOnly: false`)이 이미 존재하고 controller 노출만 없으며, `person.service.ts` 주석이 `?includeInactive=true` 도입을 후속 task 로 자인해 두었다.

본 task 는 그 **backend query 축 한 겹만** 절단한다. AdminView 의 필터 토글 · 재활성 버튼 등 web 축은 후속 slice 로 분리해 diff 를 작게 유지한다.

## Required Reading

- `src/user/person.controller.ts` — `@Controller("api/persons")` 의 `@Get()` `findActive()` 핸들러 (본 task 의 유일한 production 변경 지점)
- `src/user/person.service.ts` — `findActive()` / `findAll()` 두 메서드 (이미 존재, 변경 없음)
- `src/user/person.controller.spec.ts` — unit(mocked service) + integration(supertest) 2 부 구성. 본 task 의 spec 은 이 파일에 이어 붙인다
- `src/user/assessment.controller.ts` `97~98 행` — 기존 `@Query("...") x?: string` 선례 (string query param 수용 패턴)
- `CLAUDE.md` §3.2 (R-112 4 종 + coverage 임계)

## Acceptance Criteria

- [ ] `src/user/person.controller.ts` 의 `@Get()` 핸들러가 `@Query("includeInactive")` 를 **optional string** 으로 수용한다 (기존 선례와 동형 — DTO class 신설 금지).
- [ ] 값이 `"true"` 일 때만 `service.findAll()` 을 호출하고, 그 외(미전달 · `"false"` · 임의 문자열 · 빈 문자열)에는 기존대로 `service.findActive()` 를 호출한다. 즉 **기본 동작(휴직 제외)은 불변** 이다.
- [ ] 분기 판정 로직은 핸들러 안 1~2 줄로 유지한다 (별도 helper 파일 신설 금지 — 분기가 단일 비교라 파일 분리 ROI 0).
- [ ] happy-path unit test 1+ — `?includeInactive=true` 로 호출 시 `service.findAll()` 이 정확히 1 회 호출되고 그 반환 배열이 그대로 응답된다.
- [ ] happy-path unit test 1+ — query 미전달 시 `service.findActive()` 가 호출되고 `findAll()` 은 호출되지 않는다 (기본 동작 회귀 방지).
- [ ] error path unit test 1+ — service 가 reject 할 때 예외가 삼켜지지 않고 그대로 propagate 된다 (기존 spec 의 예외 propagation 패턴 승계).
- [ ] branch test — 두 분기(`findAll` 경로 / `findActive` 경로) 각각 1+ test 로 cover 하고, 어느 test 도 반대 분기의 service 메서드가 호출되지 않았음을 함께 단언한다.
- [ ] negative cases 충분 cover — 최소 4 종 각 1+ test: (a) `?includeInactive=false` (b) `?includeInactive=TRUE` 같은 대소문자 변형 (c) `?includeInactive=` 빈 값 (d) `?includeInactive=yes` 같은 무관한 문자열. 네 경우 모두 `findActive()` 경로로 떨어져야 한다 (판정 어휘를 넓히지 않는다).
- [ ] supertest integration test 1+ — 실제 HTTP `GET /api/persons?includeInactive=true` 가 200 + JSON 배열을 반환하고, ValidationPipe 의 `forbidNonWhitelisted` 가 query 를 400 으로 거절하지 않음을 확인한다 (query 축이 실제로 통과함을 증명).
- [ ] `pnpm lint && pnpm build && pnpm test` 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).
- [ ] `src/user/person.service.ts` `85 행` 근처의 "query param `?includeInactive=true` 도입은 후속 task" 주석이 더 이상 사실이 아니게 되므로, **그 주석 한 줄만** 현재 사실(controller 가 노출함)로 갱신한다. 그 외 service 로직 변경 0.

## Out of Scope

- **web 축 전부** — `web/src/views/AdminView.tsx` 의 휴직 인원 필터 토글 · 재활성 버튼 · `PersonList` 표시 변경은 후속 slice. 본 task 는 backend 조회 경로 개통까지만.
- `docs/requirements.md` `90 행` REQ-071 의 `IN_PROGRESS` → `DONE` 재판정 — 재활성 UI 진입점이 실제로 생긴 뒤에 별도 doc-only `direct` slice 로 한다.
- `docs/PLAN.md` `130 행` 마커 승격 (REQ-070 · REQ-072 · REQ-073 잔여로 아직 불가).
- `docs/architecture/api.md` 의 `GET /api/persons` 계약 서술 동기 — 별도 slice (본 task 에서 파일 수를 늘리지 않는다).
- 전용 endpoint 신설 (`POST /:id/reactivate` 등) — Activate 는 기존 `PATCH` + `active: true` 계약을 그대로 쓴다.
- `test/e2e/persons.e2e-spec.ts` 확장 — supertest integration 이 본 controller 안에서 이미 축을 덮으므로 e2e 는 후속 판단.
- Prisma schema · repository 변경 (`findMany({ activeOnly })` 는 이미 두 값을 지원).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 발견한 관련 작업을 여기에 추가)

---

## 완료 기록

- **완료**: 2026-08-30 09:57 (UTC) — PR [#1417](https://github.com/myungjoo/Assessment-Agent/pull/1417) squash 머지, main `e2c8e673`.
- **결과**: `GET /api/persons` 가 `?includeInactive=true` 일 때만 `findAll()`(휴직 포함), 그 외에는 종전대로 `findActive()` 를 호출한다. 분기 판정은 핸들러 안 삼항 1 줄 (`=== "true"`) — DTO class · helper 파일 신설 0, 기본 동작 불변.
- **변경**: 4 파일 `+186/-13`. `person.controller.ts`(query 분기) · `person.controller.spec.ts`(R-112 4 종) · `person.service.ts`("후속 task" 자인 주석 1 줄을 현재 사실로 갱신, 로직 0) · `web/src/views/AdminView.persons-list-contract.test.ts`(controller 소스를 읽어 `hasQuery === false` 를 단언하던 drift-guard parity — 같은 commit 에서 갱신하지 않으면 CI red 라 불가피, `AdminView.tsx` 자체는 무변경).
- **검증**: reviewer APPROVE (round 2 — round 1 Nit 은 §3 Nit-in-PR closure 로 본 PR 안에서 마감), 4-게이트 PASS, CI green. `person.controller.ts` · `person.service.ts` 각 coverage 100%, 전체 line 99.94% / function 100%. jest 13222 · vitest 3033 green.

## Follow-ups (완료 시점 추가)

- **AdminView 휴직 인원 필터 토글 + Activate 진입점** — 본 slice 가 연 조회 경로를 web 에서 소비해야 REQ-071 이 `DONE` 으로 승격 가능 (`commitMode: pr`).
- **[api.md](../architecture/api.md) 동기** — `GET /api/persons` 의 `?includeInactive` query 를 계약 문서에 반영 (`commitMode: direct`).
