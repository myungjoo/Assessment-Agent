---
id: T-1846
title: GET /api/run-status 조회 route 신설 + AppModule 등록
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-083]
estimatedDiff: 365
estimatedFiles: 5
created: 2026-09-02
sizeExempt: true
exemptReason: "R-112 4-카테고리 cover backbone × 1.5 — 항목별 근거: run-status.controller.ts 신설 +75(주석 header 20 · imports 6 · class/1 handler 49) · run-status.controller.spec.ts 신설 +230(위임 동작 describe 8 test 130 + route/guard metadata describe 6 test 100) · run-status.module.ts controllers 등록 +8/-3 · app.module.ts import 등록 +10/-2 · app.module.spec.ts 신규 describe 4 test +45. 합계 약 +368/-5. 파일 수는 5 로 cap 준수(초과 없음), LOC 만 초과. 앵커: T-1845 실측 +316/-5(3 파일, controller 배선 + spec) · T-1844 실측 +330/-58 — 본 slice 는 그 둘과 달리 controller 파일 자체를 신설하고 root DI 등록 spec 까지 동반해 +50 규모가 더 붙는다. 분할 불가 사유: controller 만 만들고 AppModule 등록을 다음 slice 로 미루면 route 가 서빙되지 않아 동작 변화 0 인 helper 단독 slice 가 되어 CLAUDE.md §3 소비처 동반 의무를 위반한다."
independentStream: run-status-adr0060
dependsOn: [T-1841, T-1842, T-1843, T-1844, T-1845]
touchesFiles:
  - src/run-status/run-status.controller.ts
  - src/run-status/run-status.controller.spec.ts
  - src/run-status/run-status.module.ts
  - src/app.module.ts
  - src/app.module.spec.ts
plannerNote: "P6 133 행 ④ R-78 polling — ADR-0060 §Follow-ups (b) 조회 route + AppModule 등록. write 축 4/4 배선 완료로 선행 해소"
---

# T-1846 — GET /api/run-status 조회 route 신설 + AppModule 등록

## Why

[PLAN.md](../PLAN.md) `133 행` bullet 의 잔여 ④ "R-78 평가 진행 배너 자동 polling(실행 상태 조회 endpoint 신설 포함)" 을 여는 slice 다. [ADR-0060](../decisions/ADR-0060-evaluation-run-status-endpoint.md) `§Follow-ups` 의 chain `(a) → (b) → (d) → (e) → (f)` 중 **(b) 조회 route + AppModule 등록** 에 해당하며, 선행 (a)(T-1841, T-1842) 와 독립 조각 (c)(T-1845) 가 모두 머지돼 "상태를 켜는 비용 있는 실행 진입점" 4/4 가 배선 완료다 — 즉 지금 route 를 열면 두 축(`evaluation` · `collection`) 모두 실제 실행을 반영하는 값을 낸다. 이 endpoint 가 없으면 [requirements.md](../requirements.md) `102 행` REQ-083 의 배너 자동 갱신은 조회 대상 자체가 없어 착수 불가다.

**issue-still-relevant pre-check 실측** (origin/main `7b7909f3` 기준):

- `git grep -n "api/run-status" -- src test web` → 매칭 **1 건뿐**이며 그것도 [run-status.service.ts](../../src/run-status/run-status.service.ts) `32 행` 의 주석(`/** GET /api/run-status 응답 body shape … */`) 이라 실제 route decorator 는 **0 건**.
- `ls src/run-status/` → `run-status.module.ts` · `run-status.module.spec.ts` · `run-status.service.ts` · `run-status.service.spec.ts` 4 개뿐 — **`run-status.controller.ts` 부재**.
- `git grep -n "RunStatusModule" -- src` → 소비처 매칭은 [assessment-collection.module.ts](../../src/assessment-collection/assessment-collection.module.ts) `56 행` · `97 행` 과 [assessment-evaluation.module.ts](../../src/assessment-evaluation/assessment-evaluation.module.ts) `42 행` · `79 행` 뿐이고 [app.module.ts](../../src/app.module.ts) `18~30 행` import 블록 · `65~78 행` `imports` 배열 어디에도 **`RunStatusModule` 없음**.
- [run-status.module.ts](../../src/run-status/run-status.module.ts) 는 `providers` · `exports` 만 있고 `controllers` 키 자체가 없으며, 주석이 "AppModule 등록은 소비처가 생기는 (b) 에서 한다" 고 명시 — 부분 안착이 아니라 **미착수** 다.
- `grep -rln "run-status.controller\|api/run-status" docs/tasks/` → T-1841 · T-1845 두 건이며 둘 다 이미 `DONE` 인 선행 slice 라 **중복 큐잉 아님**.

## Required Reading

- [docs/decisions/ADR-0060-evaluation-run-status-endpoint.md](../decisions/ADR-0060-evaluation-run-status-endpoint.md) — `§Decision 2`(endpoint 계약 · 응답 shape · 불변식), `§Decision 3`(인증 · RBAC `User+`), `§Follow-ups (b)`.
- [src/run-status/run-status.service.ts](../../src/run-status/run-status.service.ts) — `snapshot()` 반환 타입 `RunStatusSnapshot` · `RunAxisStatus` (재사용 대상, **수정 금지**).
- [src/run-status/run-status.module.ts](../../src/run-status/run-status.module.ts) — `controllers` 추가 대상.
- [src/run-status/run-status.module.spec.ts](../../src/run-status/run-status.module.spec.ts) — 기존 계약(provider 등록 · export) 확인용. 본 task 에서 **수정하지 않는다**.
- [src/app.module.ts](../../src/app.module.ts) — `18~30 행` import 블록 · `65~78 행` `imports` 배열.
- [src/app.module.spec.ts](../../src/app.module.spec.ts) — `89~148 행` `AppModule (T-0415 SchedulingModule wiring)` describe 가 본 task 신규 describe 의 형식 선례.
- [src/assessment-collection/collection-target.controller.ts](../../src/assessment-collection/collection-target.controller.ts) — `@Controller` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` 부착 형태 선례.
- [src/assessment-collection/collection-target.controller.spec.ts](../../src/assessment-collection/collection-target.controller.spec.ts) — `531 행` 이후 `route · guard · pipe metadata` describe 가 `Reflect.getMetadata("path", …)` · `"__guards__"` 단언의 선례.
- [src/auth/roles.decorator.ts](../../src/auth/roles.decorator.ts) — `ROLES_METADATA_KEY` (metadata round-trip 단언에 사용).

## Acceptance Criteria

- [ ] `src/run-status/run-status.controller.ts` 신설 — `@Controller("api/run-status")` class `RunStatusController` 가 ctor 로 `RunStatusService` 를 주입받고, `@Get()` handler 1 개가 `snapshot()` 결과를 **가공 없이 그대로** 반환한다. 반환 타입은 service 가 이미 export 하는 `RunStatusSnapshot` 을 재사용한다 (새 타입 파일 · 새 DTO 신설 금지).
- [ ] handler 에 `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("User")` 부착 — ADR-0060 `§Decision 3` 의 `User+` 경계 그대로. query parameter · request body · path parameter 를 **받지 않는다**.
- [ ] `src/run-status/run-status.module.ts` 에 `controllers: [RunStatusController]` 추가. `providers` · `exports` 는 불변이며, 주석의 "AppModule 등록은 (b) 에서 한다" 서술을 본 slice 가 등록했다는 사실로 갱신한다.
- [ ] `src/app.module.ts` 의 import 블록과 `imports` 배열에 `RunStatusModule` 을 등록하고, 파일 상단 주석 규약대로 `RunStatusModule (T-1846, ADR-0060 §Decision 2 — GET /api/run-status 조회 route 활성화)` 한 줄을 추가한다.
- [ ] colocated spec `src/run-status/run-status.controller.spec.ts` 신설 — **happy-path**: 비실행 상태에서 handler 가 `active: false` · 두 축 `runningCount: 0` · `startedAt: null` · `observedAt` 문자열을 담은 객체를 반환하고, `snapshot()` 이 정확히 1 회 호출되며 반환 객체가 service 반환값과 **동일 참조/동일 내용** 임을 단언.
- [ ] **error path** test 1+ — `snapshot()` 이 throw 하는 mock 일 때 handler 가 그 예외를 삼키지 않고 **raw 전파** 함(추가 매핑 · 기본값 대체 없음)을 단언.
- [ ] **분기 cover** — `active` 토글 양쪽을 모두 cover: (1) 평가 축만 실행 중, (2) 수집 축만 실행 중, (3) 두 축 동시 실행, (4) 둘 다 비실행 — 네 경우 각각 응답의 `active === (evaluation.active || collection.active)` 와 축별 `active === (runningCount > 0)` 불변식(ADR-0060 `§Decision 2`)을 단언.
- [ ] **negative cases 충분 cover** — 최소 다음 각 1+ test: (a) handler 가 `snapshot()` 결과의 필드를 **삭제·추가·변형하지 않음**(키 집합 완전 일치), (b) 연속 2 회 호출이 서로 다른 `observedAt` 을 그대로 흘려보내고 캐시하지 않음, (c) handler 호출이 `begin` · `end` 를 **한 번도 부르지 않음**(조회가 상태를 바꾸지 않는다 — 관측 mock 으로 0 회 단언), (d) route metadata 가 `path === "api/run-status"` 이고 method 가 `GET` 임, (e) `__guards__` metadata 에 `JwtAuthGuard` · `RolesGuard` 두 개가 부착돼 있음(미인증 401 · tier 미달 403 경계가 guard 위임임을 고정), (f) `ROLES_METADATA_KEY` metadata 가 정확히 `["User"]` 임(Admin 상향 회귀 차단).
- [ ] `src/app.module.spec.ts` 에 신규 describe 추가 — `Test.createTestingModule({ imports: [AppModule] })` 컴파일 후 (1) `RunStatusController` 가 root DI 그래프에서 주입 가능(= AppModule 등록 + module `controllers` 등록 **양쪽**이 없으면 red), (2) 주입 결과가 `undefined` · `null` 아님, (3) `RunStatusService` 도 root 그래프에서 resolve 가능, (4) 주입된 controller 의 handler 호출이 `RunStatusSnapshot` shape 을 반환. 기존 두 describe 는 수정하지 않는다.
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 통과.
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%).

## Out of Scope

- e2e spec 신설 (`test/e2e/run-status.e2e-spec.ts`) — ADR-0060 `§Follow-ups (d)` 소관, 별도 slice.
- web 쪽 polling 배선 (`web/src/api/runStatus.ts` · `web/src/AppShell.tsx` · `EvaluationGuardBanner`) — `§Follow-ups (e)` 소관.
- doc-sync ([api.md](../architecture/api.md) 표 행 추가 · [frontend-api-contract.md](../architecture/frontend-api-contract.md) `87 행` gap 갱신) 와 [requirements.md](../requirements.md) `102 행` REQ-083 status 재판정 · [PLAN.md](../PLAN.md) `133 행` ④ 마커 — `§Follow-ups (f)` 소관이며 CLAUDE.md `§3.1` 규칙 6 상 (e) 까지 머지된 뒤 1 회만 수행한다. 본 slice 에서 건드리지 않는다.
- `RunStatusService` 본문 수정 (`begin` / `end` / `snapshot` / 타입) — 조회 route 는 순수 소비자다.
- 새 DTO · 새 응답 타입 파일 · class-validator 스키마 신설 (query parameter 가 0 이라 검증 대상이 없다).
- polling 주기 · 캐시 · rate limit · 다중 인스턴스 대응 — ADR-0060 `§Decision 5` 가 명시적으로 범위 밖으로 둔 사항.
- 새 외부 dependency 추가 (있으면 CLAUDE.md `§5` 게이트 → BLOCKED).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업 발견 시 여기에 append)
