---
id: T-0358
title: ADR-0039 KST impl chain 3/5 — PeriodBridge 배선이 periodStart 를 KST period boundary 로 정규화 (helper 경유)
phase: P5
status: DONE
commitMode: pr
prNumber: 290
mergedAs: e10a747
reviewRounds: 2
coversReq: [REQ-004, REQ-034]
estimatedDiff: 190
estimatedFiles: 4
independentStream: adr-0039-kst-impl
dependsOn: [T-0356, T-0357]
touchesFiles:
  - src/common/period-boundary.ts
  - src/common/period-boundary.spec.ts
  - src/assessment-evaluation/assessment-evaluation.controller.ts
  - src/assessment-evaluation/assessment-evaluation.controller.spec.ts
  - src/assessment-evaluation/summary-aggregate-orchestrator.service.ts
created: 2026-06-13
plannerNote: "ADR-0039 KST chain 3/5 — PeriodBridge 배선: 실코드 확인 결과 boundary 정규화 지점은 controller period() 의 periodStart→since/coordinate 패스, helper 경유 snap (wiring+spec ~190 LOC); T-0355 교집합 0"
---

# T-0358 — ADR-0039 KST impl chain 3/5: PeriodBridge 배선이 `periodStart` 를 KST boundary 로 정규화

## Why

[ADR-0039](../decisions/ADR-0039-timezone-kst-boundary-policy.md) §Status impl chain 3번째 = §Decision5 의 helper 경유 의무 컴포넌트 (ii) **`PeriodBridge`** 배선이다. 실코드 확인 결과 두 bridge service (`PeriodBridgeEphemeralService.generateEphemeral` / `PeriodBridgeAdminPersistService.generateAndPersist`) 는 `period: { since?: string }` 와 `context.periodStart` 를 **도출 0 / pass-through** 로 받는 순수 compose 라 boundary 산술이 service 안에 없다. boundary 가 실제로 입력되는 지점은 **`assessment-evaluation.controller.ts` 의 `period()` endpoint** — `dto.periodStart` (raw ISO string) 를 (a) Admin 분기에서 `new Date(dto.periodStart)` 로 persist 좌표 `periodStart` (4-tuple axis) 로, (b) 양 분기에서 `{ since: dto.periodStart }` 로 collection 에 흘려보낸다.

본 배선은 그 raw `periodStart` 를 **요청 `period` granularity 의 canonical KST period boundary 로 snap** 해 좌표/`since` 로 쓰게 한다 (§Decision3 (a)~(c) + §Decision5 — boundary 계산 중복 금지). 효과: (1) 동일 instant 가 항상 동일 canonical boundary 로 수렴 → persist 좌표 (`personId/period/scope/periodStart`) 의 idempotency 안정화 (ADR-0037 §Decision4 / ADR-0038 first-write-wins 의 좌표가 KST 자정/주초/월초로 정렬), (2) 같은 KST 일/주/월 안의 서로 다른 시각 입력이 같은 평가 단위로 묶임 (사용자 직관 정합). T-0356 helper (`getKstPeriodRange`) + T-0357 가 만든 granularity 매핑을 single source 로 재사용해 drift 를 구조적으로 차단한다.

## Required Reading

- `docs/decisions/ADR-0039-timezone-kst-boundary-policy.md` — §Decision3 (a)~(c) 일/주/월 boundary 정의 + 반열림 `[start, end)`, §Decision5 (helper 1 점 집중 + 경유 의무 컴포넌트 (ii) PeriodBridge, boundary 계산 중복 금지)
- `src/common/period-boundary.ts` — T-0356 helper. `getKstPeriodRange(g, instant): { start, end }` (instant 가 속한 KST period 의 start/end), `PeriodGranularity = "daily"|"weekly"|"monthly"`, `parseKstPeriodInput(input)`
- `src/common/period-boundary.spec.ts` — colocated spec (본 task 가 새 export 추가 시 그 spec 도 여기에 colocate)
- `src/assessment-evaluation/assessment-evaluation.controller.ts` — 수정 대상. `period()` / `ephemeralForUser()` / `persistForAdmin()` — `dto.periodStart` 가 `since` / context `periodStart` 로 흐르는 3 지점
- `src/assessment-evaluation/assessment-evaluation.controller.spec.ts` — colocated spec (위임 정합 검증 패턴 — 본 배선 검증 추가 대상)
- `src/assessment-evaluation/domain/period-evaluable.ts` — T-0357 의 `PERIOD_TO_BOUNDARY_GRANULARITY` (`day→daily` 등) 매핑 (현재 module-private `const` — 본 task 의 single-source 재사용 판단 입력)
- `src/assessment-evaluation/summary-aggregate-orchestrator.service.ts` — L90 부근 jsdoc (T-0357 Follow-up: Invalid Date periodStart 의 helper TypeError 전파 한 줄 동기 대상, read+1줄 amend)
- `docs/decisions/ADR-0012-cross-cutting-field-policy.md` §1 — 저장 timezone = UTC single source (본 task 변경 금지 — boundary snap 의 입출력은 UTC Date instant)

## 구현 가이드

- **정규화 지점 = controller `period()` 경로 1 곳** — `dto.periodStart` → `new Date(dto.periodStart)` 한 instant 를 `getKstPeriodRange(granularity(dto.period), instant).start` 로 snap 한 canonical UTC Date 를 산출하고, 그 값을 (a) Admin context `periodStart` 좌표, (b) 양 분기 `since` (ISO string `.toISOString()`) 로 쓴다. snap 산출을 controller-private helper (예: `normalizeKstPeriodStart(period, periodStart)`) 1 곳으로 모아 두 분기가 공유한다 (중복 산술 금지 §Decision5).
- **granularity 매핑 single source** — `period` (`day/week/month`, ADR-0006 enum-as-String DB 저장값 — **rename 금지**) → helper granularity (`daily/weekly/monthly`) 매핑은 이미 `period-evaluable.ts` 에 `PERIOD_TO_BOUNDARY_GRANULARITY` 로 존재한다. **중복 정의 금지** — 다음 중 하나로 single source 재사용: (i) `period-boundary.ts` 에 `getKstPeriodRangeByPeriod(period: string, instant): PeriodRange` 또는 매핑 상수를 export 로 lift 하고 period-evaluable + 본 배선이 둘 다 import, 또는 (ii) `period-evaluable.ts` 의 매핑/`computePeriodEnd` 인접에 boundary-start 산출 export 추가 후 재사용. (i) 이 helper 1 점 집중 (§Decision5) 에 더 부합 — implementer 가 선택하되 매핑이 두 군데 박제되지 않게 한다.
- **알 수 없는 period 처리** — `dto.period` 가 `day/week/month` 밖이면 snap 전 명시적 reject (helper `getKstPeriodRange` 의 `RangeError` 또는 controller 의 400/BadRequest 매핑). 기존 동작 (허용 literal 검증은 persist service 책임) 과의 정합 — 본 배선이 silent Invalid coordinate 를 만들지 않게 한다. snap 함수에 닿기 전 `dto.periodStart` 가 Invalid (DTO `@IsISO8601` 통과했으나 `new Date` Invalid 인 edge) 면 helper `assertValidDate` 의 TypeError 가 전파된다.
- **공개 contract 불변** — `period()` endpoint 의 path/메서드/요청 DTO (`PeriodBridgeDto`)/응답 shape (`EvaluationResult[]` | `PeriodBridgeAdminResponse`) 유지. bridge service signature 변경 0. snap 은 controller 안에서만.
- **새 dependency 0** — helper 가 Node 내장 Intl 만 사용. `package.json` 변경 금지.
- **jsdoc 동기 (T-0357 Follow-up 수용)** — `summary-aggregate-orchestrator.service.ts` L90 부근 jsdoc error 계약에 "Invalid Date periodStart → helper TypeError 전파" 한 줄을 추가한다 (도큐 동기 — production 동작 변화 0).

## Acceptance Criteria

- [ ] controller `period()` 경로가 `dto.periodStart` 를 `getKstPeriodRange(...).start` (또는 그 wrapper) 로 snap 한 canonical KST boundary 를 Admin context `periodStart` 좌표 + 양 분기 `since` 로 사용한다 (inspect: controller 에 helper import + raw `new Date(dto.periodStart)` 가 좌표/since 로 직접 흐르지 않음).
- [ ] granularity 매핑이 single source 다 — `day→daily` 매핑이 controller 와 period-evaluable 두 군데에 중복 정의되지 않는다 (inspect: 매핑 상수/함수 export 1 곳 + 양쪽 import).
- [ ] happy-path test 1+ — Admin 분기: 같은 KST 일/주/월 안의 서로 다른 입력 instant 2 개 (예 `2026-06-11T00:00:00+09:00` 와 `2026-06-11T23:00:00+09:00`) 가 동일 canonical `periodStart` 좌표로 snap 됨 (day granularity). User 분기: snap 된 `since` 로 `generateEphemeral` 위임 검증. day/week/month 각 1+.
- [ ] error path test 1+ — 알 수 없는 `period` (예 `"year"`) → snap reject 전파 (위임 미호출) + DTO 통과했으나 Invalid Date 인 `periodStart` → helper TypeError 전파.
- [ ] 분기 cover — Admin vs User dispatch 각 1+, granularity 3 종 (day/week/month) snap 각 1+, reevaluate fail-closed (User) 경로는 snap 보다 선행 차단 유지 (기존 동작 회귀 0) 1+.
- [ ] negative cases 충분 cover — KST 자정 직전/직후 경계 (`2026-06-10T14:59:59.999Z` vs `2026-06-10T15:00:00Z`) 가 서로 다른 KST 일로 snap, 월말 입력 (`2026-05-31T15:00:00Z` = KST 6/1 자정, month granularity) 이 6 월 월초 좌표로 snap (T-0357 overflow 결함 인접), 빈/비-Admin reevaluate, type mismatch 성 입력 각 1+.
- [ ] `summary-aggregate-orchestrator.service.ts` jsdoc 에 Invalid Date periodStart 의 helper TypeError 전파 한 줄 추가 (T-0357 Follow-up closure — inspect).
- [ ] `pnpm test:cov` 통과 (line ≥ 80% / function ≥ 80%) + `pnpm lint && pnpm build` green (push 후 PR CI green 확인).

## Out of Scope

- bridge service (`period-bridge-ephemeral.service.ts` / `period-bridge-admin-persist.service.ts`) 의 signature/내부 변경 — 순수 pass-through compose 라 snap 책임은 controller (배선 진입점). service 는 snap 된 값을 받기만 한다.
- `PeriodBridgeDto` 의 `@IsISO8601` 형식 검증 외 추가 boundary 강제 — DTO 는 형식만 (기존 관행 정합), snap 은 controller orchestration.
- chain 4/5 — R-9 사용자 지정 기간 DTO 의 `parseKstPeriodInput` 소비 (offset 미명시 시 KST 해석 — `period()` 가 아닌 R-9 임의 기간 입력 surface). 본 task 는 좌표 boundary snap 만.
- chain 5/5 — view-layer formatter (조회 endpoint 응답 직렬화 / P6 Web UI 표시 layer §Decision4 default Asia/Seoul).
- `SinceDerivationService` 변경 (boundary 산술 0 — ADR-0039 도 Out of scope, T-0357 에서 확인) / 1 주 재수집 window (Q-0026 잔여, ADR-0029/0035 후속).
- `VALID_PERIODS` 값 rename / ADR-0006 enum-as-String DB 저장값 변경.
- 새 외부 dependency 추가 (`date-fns-tz` 등) — §5 BLOCKED 게이트.
- **T-0355 (credential 보류 중) 의 touchesFiles 일절 금지** — `.github/workflows/ci.yml` / `scripts/check-spec-presence*` / `package.json` / `test/smoke/web-static*` / `docs/architecture/directory.md` / `web/` 변경 0 (교집합 0 유지).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — ADR-0039 가 design 박제 완료, snap 배선 위치만 implementer 결정).

## Follow-ups

(생성 시점 비어 있음)
