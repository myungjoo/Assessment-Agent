---
id: T-0538
title: 의도 좌표 enumeration 순수 helper enumerateIntendedPeriodCoordinates 추가
phase: P5
status: DONE
commitMode: pr
completedAt: 2026-06-19T23:52:00Z
mergeCommit: 2329d96
prNumber: 452
coversReq: [REQ-037]
dependsOn: []
independentStream: evaluation-coverage-gap
touchesFiles:
  - src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts
  - src/assessment-evaluation/domain/evaluation-intended-period-coordinates.spec.ts
estimatedDiff: 240
estimatedFiles: 2
created: 2026-06-20
plannerNote: P5 bullet 106(R-64/REQ-037) — T-0536 selectUnevaluatedPeriods 의 intended 입력을 산출하는 상류 dependency-free 순수 helper, KST boundary helper 재사용
---

# T-0538 — 의도 좌표 enumeration 순수 helper enumerateIntendedPeriodCoordinates 추가

## Why

PLAN.md P5 bullet 106(R-64) "평가 재실행·부분 reset" / [README REQ-037](../requirements.md) "평가 없는 부분 일괄 평가 + Reset & Reeval" detection→consume 사슬의 **상류 짝**을 박제한다. 직전 T-0536 `selectUnevaluatedPeriods`([evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts)) 는 두 좌표 집합(`intended`, `persisted`)의 차집합으로 미평가 gap subset 을 derive 하고, T-0537 `buildUnevaluatedFillBatchPlan`([evaluation-unevaluated-fill-batch-plan.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-fill-batch-plan.ts)) 은 그 gap 좌표를 person 별 일괄 batch 로 요약한다. **그러나 `intended` 집합 자체를 어디서 어떻게 생성할지** 는 아직 박제되지 않았다 — T-0536 의 Out of Scope("`intended` 좌표 집합을 *생성* 하는 로직(기간 enumeration 등) — 본 helper 는 주어진 두 집합의 차집합만 derive") 가 그 슬라이스를 의도적으로 분리해뒀다. 본 task 는 `(personIds, period, scope, rangeStart, rangeEnd)` 입력으로 KST boundary 기반 `EvaluationPersistContext[]` 의도 좌표를 결정적으로 enumerate 하는 dependency-free 순수 domain helper 1 개를 신설한다 — REQ-037 detection 사슬의 **첫 입력** 을 닫는 조각으로, orchestrator/DB-read 실배선(persist read + period range 결정)은 후속 wiring slice 의 책임이다. `period-evaluable.ts` 의 `getKstPeriodRangeByPeriod` / `isPeriodEvaluable` 와 동일한 KST boundary single source 를 재사용해 timezone drift 를 구조적으로 차단한다(ADR-0039 §Decision 5).

## Required Reading

- [src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts](../../src/assessment-evaluation/domain/evaluation-unevaluated-period-select.ts) — T-0536 산출 helper. 본 함수의 **출력**(`EvaluationPersistContext[]`) 이 T-0536 의 `intended` 입력으로 그대로 흘러간다. 좌표 동일성 키 4-tuple(`personId / period / scope / periodStart`) 의미와 `periodStart` `getTime()` instant 정규화 정신을 따라야 한다(키 합성은 본 helper 책임 아님 — 좌표 element 생성만).
- [src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts](../../src/assessment-evaluation/domain/evaluation-result.persist.mapper.ts) — `EvaluationPersistContext { personId, period, scope, periodStart: Date }` 좌표 타입 (L47~52). 본 helper 의 출력 element 타입으로 `import type` 재사용한다(새 좌표 타입 발명 금지).
- [src/assessment-evaluation/domain/period-evaluable.ts](../../src/assessment-evaluation/domain/period-evaluable.ts) — KST boundary helper(`getKstPeriodRangeByPeriod` / `isValidPeriod` / `computePeriodEnd` / `isPeriodEvaluable`) 의 mirror 패턴. 본 helper 는 같은 boundary 산술 single source 를 사용해 drift 0 을 보장한다(ADR-0039 §Decision 5).
- [src/common/period-boundary.ts](../../src/common/period-boundary.ts) — `getKstPeriodRangeByPeriod(period, instant) → { start, end }` 의 직접 호출 대상. periodStart anchor 추출 및 다음 period anchor 진행에 사용. 반열림 구간 `[start, end)` 의미.
- [src/assessment-evaluation/domain/evaluation-dedup.ts](../../src/assessment-evaluation/domain/evaluation-dedup.ts) — 순수 도메인 helper 의 mirror 패턴(Map / 배열 누적 + 입력 등장 순서 보존 + 비변형 + 한국어 JSDoc + 명시적 null/undefined `TypeError`). 본 helper 의 구조 정합 기준.
- [docs/decisions/ADR-0033-evaluation-result-persistence.md](../decisions/ADR-0033-evaluation-result-persistence.md) §Decision 3 — `"fill"`(평가 없는 부분만 채움) semantics. 본 enumeration 이 그 fill 대상 의도 좌표를 산출하는 첫 단계임을 확인(재구현 0, single-source 정신).
- [docs/decisions/ADR-0039-evaluation-timezone.md](../decisions/ADR-0039-evaluation-timezone.md) §Decision 3 / §Decision 5 — KST(Asia/Seoul) boundary + boundary 산술 single source `period-boundary.ts` 경유. 본 helper 는 직접 KST offset 산술 금지, 반드시 `getKstPeriodRangeByPeriod` 경유.

## Acceptance Criteria

새 파일 `src/assessment-evaluation/domain/evaluation-intended-period-coordinates.ts` (colocated spec `evaluation-intended-period-coordinates.spec.ts`):

- [ ] 순수 함수 `enumerateIntendedPeriodCoordinates(input: IntendedPeriodCoordinatesInput): EvaluationPersistContext[]` export. 의존성 0(NestJS `@Injectable` 0 / Prisma 0 / LLM 호출 0 / repository 0). `EvaluationPersistContext` 는 persist.mapper.ts 에서 `import type` 으로 재사용(새 좌표 타입 발명 0). 본 task 가 신설하는 타입은 입력 wrapper `IntendedPeriodCoordinatesInput { personIds: string[]; period: string; scope: string; rangeStart: Date; rangeEnd: Date }` 1 종만.
- [ ] KST boundary 산술 — `getKstPeriodRangeByPeriod(period, instant)`([period-boundary.ts L142](../../src/common/period-boundary.ts)) 만 사용해 period anchor 를 순회. **직접 setUTC\* / +/- ms 같은 timezone 산술 0**(ADR-0039 §Decision 5 single-source). 알 수 없는 `period` 는 `period-boundary.ts` 의 RangeError 가 자연 전파.
- [ ] 좌표 enumeration 규칙: `rangeStart` 가 속한 KST period 의 anchor(`getKstPeriodRangeByPeriod(period, rangeStart).start`)부터 시작해, 각 anchor 가 `rangeEnd` 미만(`anchor.getTime() < rangeEnd.getTime()`)인 동안 다음 anchor 로 진행(`getKstPeriodRangeByPeriod(period, anchor).end` 이 다음 anchor). 각 anchor 에 대해 `personIds` 의 각 person 별로 `{ personId, period, scope, periodStart: anchor }` 좌표 1 개 생성. **person × period anchor 데카르트 곱** 을 반환.
- [ ] 반환 순서 결정성 — **outer 는 period anchor 시간순(과거→미래), inner 는 `personIds` 입력 등장 순서**. 한 anchor 의 모든 person 좌표가 다음 anchor 의 person 좌표보다 앞선다(이중 stable 정렬, JSDoc 명시).
- [ ] 좌표 `periodStart` 는 **새 Date 인스턴스** 로 채워 입력 변형 0 + 호출자가 mutate 해도 plan 영향 0(period-boundary helper 가 이미 새 Date 반환 — 그 결과를 그대로 좌표 element 로 사용). `personIds` 배열은 변형 0(반환 좌표 element 의 `personId` 는 입력 string 참조 그대로 — string 은 immutable).
- [ ] 비변형 + 결정성 — 입력 객체/배열 mutate 0, 같은 입력이면 같은 출력(시계 비의존). 빈 `personIds` → 빈 배열, `rangeStart >= rangeEnd` → 빈 배열(반열림 정신 `[rangeStart, rangeEnd)`), `rangeEnd` 가 첫 anchor 의 end 이하면 anchor 1 개만 생성 또는 0 개(boundary edge 정책 JSDoc 명시 후 spec 검증).
- [ ] 방어적 입력 처리 — `input` null/undefined 또는 `personIds` / `rangeStart` / `rangeEnd` / `period` / `scope` 누락 / 타입 불일치 시 한국어 메시지 `TypeError`(evaluation-dedup.ts + T-0536 방어 패턴 mirror). `rangeStart` / `rangeEnd` 가 `Date` 가 아니거나 Invalid Date 시 `TypeError`. `personIds` 원소가 string 아니면 `TypeError`.
- [ ] **Happy-path test 1+** — 단일 person × 단일 day anchor / 다수 person × 다수 week anchor / 다수 person × 다수 month anchor 데카르트 곱이 시간순 + 입력 person 순서로 정렬돼 반환되는지 검증. KST anchor 정확성(예: `period="day"` 입력 `rangeStart=2026-01-15T12:00:00Z` → 첫 anchor 가 KST 2026-01-15 00:00 = `2026-01-14T15:00:00Z`) 검증 1+.
- [ ] **Error path test 1+** — `input` null/undefined → `TypeError`. `personIds` null/undefined / non-array → `TypeError`. `rangeStart` 또는 `rangeEnd` 가 Date 가 아님 / Invalid Date → `TypeError`. 알 수 없는 `period`(예: `"hour"`) → `RangeError`(`period-boundary.ts` 의 자연 전파, 본 helper 가 재던지지 않아도 됨 — 단 spec 에서 throw 검증).
- [ ] **Flow / branch coverage** — 각 분기 1+ test: (a) 빈 `personIds` → 빈 배열(다른 입력 정상이어도) (b) `rangeStart >= rangeEnd` → 빈 배열 (c) 단일 anchor 구간(`rangeEnd` 가 다음 anchor end 직전) (d) 다수 anchor 구간(첫 anchor end 가 `rangeEnd` 미만 → 2+ anchor) (e) period="day" / "week" / "month" 각 granularity 1+ test (f) `rangeStart` 가 정확히 KST period boundary 인 경우 vs 임의 mid-period 인 경우 둘 다 같은 첫 anchor 산출 검증(boundary snap 정신).
- [ ] **Negative cases 충분 cover** — 각 1+ test: ① `personIds` 원소 non-string(number 등) → `TypeError` ② `personIds` 원소 빈 문자열("") 허용(정규화 안 함, exact match — T-0536 정신) ③ `personIds` 내부 중복(예: `["a","a","b"]`) → 중복 person 만큼 좌표가 중복 생성됨(dedup 안 함, 호출자 책임 JSDoc 명시) ④ `scope` 빈 문자열 허용(exact match) ⑤ 호출자가 반환 배열을 mutate 해도 다시 호출 시 다른 결과 0(결정성 + 반환 격리) ⑥ `period="month"` 의 가변일(28~31 일) anchor 진행 정확성(예: 2026-02 → 2026-03 의 anchor 가 KST 2026-03-01 00:00 = `2026-02-28T15:00:00Z`) ⑦ 출력 좌표 element 의 `periodStart.getTime()` 이 KST anchor instant 와 정확히 일치하는지(period-boundary single-source 신뢰 검증).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80%) — 신규 파일은 line/branch/function/stmt 100% 목표.
- [ ] `pnpm lint && pnpm build` clean.

## Out of Scope

- T-0536 `selectUnevaluatedPeriods` / T-0537 `buildUnevaluatedFillBatchPlan` 변경 — 본 helper 는 그 입력 측 짝으로 추가만 한다(상류 불변).
- orchestrator / service / controller 실배선(enumeration → 차집합 → batch plan → 실제 일괄 평가 실행을 `EvaluationOrchestratorService` 나 period bridge 에 compose 하는 것) — 별도 후속 wiring slice. 본 helper 는 순수 함수만.
- DB read(영속화된 좌표를 Prisma 로 조회해 `persisted` 인자를 산출) — 본 helper 책임 아님(T-0536 의 두 번째 입력 측 역시 별도 후속 slice 의 책임).
- 평가 가능 시점 필터(`isPeriodEvaluable(now)` 적용해 미완료 진행 중 period 를 제외) — 본 helper 는 **순수 enumeration** 만(시계 비의존, 결정성 보호). 평가 시점 필터는 호출자가 `period-evaluable.ts` 의 `isPeriodEvaluable` 를 별도로 적용한다(분리된 책임).
- `period` granularity 확장(예: "quarter" / "year") — 본 helper 는 `period-boundary.ts` 의 `PERIOD_TO_GRANULARITY` single source(`day` / `week` / `month`) 만 지원. 확장은 별도 ADR + boundary helper 변경 동반.
- `reeval` / overwrite 경로 변경(ADR-0038 완료분) — 본 helper 와 직교, 건드리지 않는다.
- 새 좌표 타입 / DTO 신설(`EvaluationPersistContext` 재사용, 입력 wrapper `IntendedPeriodCoordinatesInput` 1 종만 신설 허용), schema / migration, 새 dependency — 전부 금지(§5 게이트 미발화 유지).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
