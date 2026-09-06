---
id: T-1931
title: 좌표별 개발자 간 상대 비교 순수 helper 신설 (REQ-036 상대 비교 산출 축)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-036]
estimatedDiff: 320
estimatedFiles: 2
sizeExempt: true
exemptReason: "R-112 backbone 카테고리 × 1.5 (base 210 → 315). 선례 T-1923(est 340) · T-1925(est 330 / 실측 330) 와 동형인 domain 순수 helper + colocated spec 2 파일 구성이며 파일 수 2 는 cap(≤ 5) 안."
created: 2026-09-06
independentStream: p5-req036-relative-comparison
dependsOn: []
touchesFiles:
  - src/assessment-evaluation/domain/summary-relative-comparison.ts
  - src/assessment-evaluation/domain/summary-relative-comparison.spec.ts
plannerNote: "P5 REQ-036 — metricScore 는 있으나 person 간 순위·백분위 산출 경로 0. 결정적 순수 helper 1 개 신설 (배선은 Follow-up)"
---

# T-1931 — 좌표별 개발자 간 상대 비교 순수 helper 신설 (REQ-036 상대 비교 산출 축)

## Why

[docs/requirements.md](../requirements.md) `55 행` REQ-036 (README `63 행` — 상대 비교 가능 + LLM 정성 + Metric 수치) 은 `IN_PROGRESS` 이고 미충족 축이 **"개발자 간 상대 비교 전용 산출 경로 부재"** 하나다. 판정 본문이 그대로 적듯 LLM 정성 축 (`summary-narrative.service.ts`) · Metric 수치 축 (`summary-aggregate.ts` `84 행` `aggregateMetricScore`) · 한 row 결합 영속 축은 이미 실재하고, [`summary-aggregate.ts`](../../src/assessment-evaluation/domain/summary-aggregate.ts) `52~57 행` 주석이 "모든 person 에 동일 규칙이 적용되므로 산출된 per-person metricScore 는 서로 비교 가능하다" 고 **비교 가능성만** 선언한 채 비교를 실제로 수행하는 심볼은 두지 않았다. 본 slice 는 그 마지막 축의 **결정적 산출 helper** 를 신설한다 — 코드 축 선례 [`evaluation-notable-contribution-signal.ts`](../../src/assessment-evaluation/domain/evaluation-notable-contribution-signal.ts) · 문서 축 선례 [`evaluation-document-contribution-signal.ts`](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) (T-1923) 와 동형인 의존성 0 순수 함수다.

**issue-still-relevant pre-check (origin/main `f943ee44` 실측)**:

1. `git grep -niE "rank|percentile" -- "src/**/*.ts"` 의 비-spec 히트는 [`src/import/import-restore-order.ts`](../../src/import/import-restore-order.ts) `39 행` `INSERT_RANK` (FK 삽입 순서 상수) 뿐이고, 평가 · 요약 layer 의 person 간 순위 · 백분위 심볼은 **0 행** 이다.
2. `git grep -n "상대 비교" -- "src/**/*.ts"` 히트 7 건은 전부 **주석** 이다 — `summary-aggregate.ts` `47`·`52 행`, `evaluation-result.persist.mapper.ts` `71 행`, `evaluation-result-persist.service.ts` `56 행`, `evaluation-notable-contribution-signal.ts` `13 행` 등. 실행 로직 0.
3. 조회 경로도 person 간 비교를 하지 않는다 — [`summary.repository.ts`](../../src/user/summary.repository.ts) `104~119 행` `findByPerson` 은 `where` 가 항상 `personId` 단일 (또는 `personId` + `period`) 이고 `orderBy` 는 `periodStart: "desc"` 시계열 정렬뿐이며, [`summary.controller.ts`](../../src/user/summary.controller.ts) `100~112 행` `@Get()` 도 `personId` 필수 query 라 **다중 person 집합을 애초에 만들지 않는다**.
4. 문서 축에도 선반영이 없다 — `docs/architecture/` 전수에 순위 · 백분위 endpoint 박제 0 (`frontend-api-contract.md` `105 행` 미구현 목록의 잔여 4 항목에도 없음).

즉 main 에 같은 의도가 이미 안착한 중복 task 가 아니다.

**오너 지시 게이트 pre-check (4 건 전부 회피 근거 있음)**:

- [PLAN](../PLAN.md) `157 행` (R-91 k6 부하검증 최우선): 본 slice 는 그 chain 과 **경합하지 않는다** — R-91 의 잔여 축은 `실 수집 → 평가` 왕복이고 [PLAN](../PLAN.md) `161 행` 이 밝히듯 `LOAD_TEST_STUB=1` · 자격증명 0 이라 **자율 집행 불가** (사람 개입 게이트). 본 slice 는 `test/load/` · `.github/workflows/load-k6.yml` · `package.json` 을 건드리지 않는다.
- [PLAN](../PLAN.md) `158 행` (R-92 per-route perf baseline churn 중단): 본 slice 는 `test/perf/` 에 파일을 만들지도 고치지도 않는다. 금지 대상(신규 per-route baseline slice) 밖이다.
- [PLAN](../PLAN.md) `182 행` (슬라이스 과분할 차단 — 소비처 동반 의무): 본 slice 는 helper 신설이므로 원칙상 소비처 배선을 같은 PR 에 넣어야 하나, 배선 일습 (repository 다중 person 조회 + service + controller + query DTO + 각 colocated spec) 을 합치면 **파일 7 · 약 700 LOC** 로 cap(≤ 300 LOC / ≤ 5 파일) 을 **이중 초과** 한다. 그래서 예외 조항을 적용하고 아래 `Follow-ups (a)` 에 배선을 파일 · 심볼 단위로 명시한다 (T-1923 → T-1924, T-1925 → T-1926 과 같은 선례 형식).
- [PLAN](../PLAN.md) `183 행` (REQ 재판정 왕복 제거 — 구현 후 1 회만): 본 slice 는 `docs/requirements.md` 를 건드리지 않는다. REQ-036 재판정은 배선까지 머지된 뒤 **1 회만** 하며 `Follow-ups (c)` 로 남긴다.

## Required Reading

- [src/assessment-evaluation/domain/summary-aggregate.ts](../../src/assessment-evaluation/domain/summary-aggregate.ts) `40~63 행` (가중치 · REQ-036 비교 가능성 주석 · `METRIC_SCORE_PRECISION = 6`) · `67~71 행` (`roundTo`) · `84~115 행` (`aggregateMetricScore` 진입 + 빈 입력 결정적 0) — 본 helper 가 소비할 점수의 정의와 **재사용할 정밀도 규약**.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.ts) 전문 (`173 행`) — 가장 최근의 동형 선례 (T-1923). `54 행` 상수 export · `57`·`68 행` 인터페이스 2 종 · `106~117 행` 한국어 `TypeError` 계약 · 파일 머리 주석의 "보수성 원칙(휴리스틱 과확장 금지)" 서술 형식을 그대로 mirror 한다.
- [src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts](../../src/assessment-evaluation/domain/evaluation-document-contribution-signal.spec.ts) — colocated spec 의 describe / it 구성 · negative 케이스 열거 방식 mirror 대상.
- [src/assessment-evaluation/domain/evaluation-volume.ts](../../src/assessment-evaluation/domain/evaluation-volume.ts) `31~44 행` — 비-number / 비유한수 입력을 throw 없이 `0` 으로 절하하는 기존 보수 규약 (본 helper 의 `metricScore` 정규화가 따라야 할 선례).
- [prisma/schema.prisma](../../prisma/schema.prisma) `361~380 행` `Summary` model — `personId` / `period` / `periodStart` / `metricScore Decimal` 와 `377 행` `@@unique([personId, period, periodStart])`. 좌표당 person 1 행 보장이 본 helper 의 **중복 personId = 호출자 계약 위반** 근거다.
- [src/user/summary.repository.ts](../../src/user/summary.repository.ts) `95~119 행` · [src/user/summary.controller.ts](../../src/user/summary.controller.ts) `90~112 행` — 현 조회 경로가 단일 person 전용임을 확인하는 read-only 좌표 (본 task 에서 **수정 금지**, Follow-up (a) 대상).
- [docs/requirements.md](../requirements.md) `55 행` REQ-036 — 미충족 축의 정본 서술 (read-only, 본 task 에서 수정 금지).
- [CLAUDE.md](../../CLAUDE.md) `§3.2` (R-110 · R-112) · `§12` (언어 정책 · `§ 12.76` 행 범위 표기).

## 설계 계약 (구현자가 임의로 바꾸지 않는다)

신규 파일 `src/assessment-evaluation/domain/summary-relative-comparison.ts` 는 의존성 0 (NestJS · Prisma · gateway import 0) 의 순수 모듈이며 아래를 export 한다.

1. `RelativeComparisonEntry` — `{ personId: string; metricScore: number }`. 한 좌표 `(period, periodStart)` 안의 person 1 명 입력.
2. `PersonRelativeStanding` — `{ personId: string; metricScore: number; rank: number; percentile: number }`.
3. `RelativeComparisonResult` — `{ cohortSize: number; mean: number; byPerson: PersonRelativeStanding[] }`.
4. `computeRelativeComparison(entries: RelativeComparisonEntry[]): RelativeComparisonResult` — 순수 · 결정적 · 입력 비변형.

판정 규칙 (전부 결정적):

- **정규화** — `metricScore` 가 number 가 아니거나 비유한수(`NaN` / `Infinity`) 면 `0` 으로 절하한다 (`evaluation-volume.ts` `33~39 행` 보수 규약 mirror, throw 하지 않는다). 절하된 값이 `byPerson[].metricScore` 에도 그대로 실린다.
- **rank** — 점수 **내림차순** 의 1-based competition ranking. 동점은 **같은 rank** 를 받고 다음 rank 는 동점 인원 수만큼 건너뛴다 (예: 두 명 동점 1 위 → 다음은 3 위).
- **percentile** — `자신보다 낮은 점수를 가진 인원 수 / cohortSize × 100`. 최하위(자기 아래 0 명)는 `0`, 동점자는 서로 같은 값. `METRIC_SCORE_PRECISION`(6 자리) 규약과 같은 방식으로 round 한다.
- **mean** — 정규화 후 `metricScore` 의 산술 평균을 같은 정밀도로 round.
- **byPerson 정렬** — rank 오름차순 (= 점수 내림차순). **동점 내부 순서는 입력 최초 등장 순서를 보존** 한다 (`evaluation-document-contribution-signal.ts` 의 최초 등장 순서 보존 규약 mirror).
- **빈 입력** — `{ cohortSize: 0, mean: 0, byPerson: [] }` (`aggregateMetricScore` 의 빈 입력 결정적 0 정합, throw 하지 않는다).
- **throw 경로 2 종만** — (i) `entries` 자체가 `null` / `undefined` 일 때 (ii) 같은 `personId` 가 2 회 이상 등장할 때 (`@@unique([personId, period, periodStart])` 로 좌표당 1 행이 보장되므로 중복은 호출자 계약 위반). 둘 다 함수명을 포함한 **한국어 메시지의 `TypeError`** 이며 그 밖의 throw 경로는 만들지 않는다.

정밀도 상수는 새로 만들지 말고 `summary-aggregate.ts` 의 규약을 재사용하거나 (export 되어 있지 않다면) 같은 값 · 같은 round 방식임을 주석으로 명시한다. `summary-aggregate.ts` 를 **수정하지 않는다**.

## Acceptance Criteria

- [ ] `src/assessment-evaluation/domain/summary-relative-comparison.ts` 가 신설되고 위 설계 계약의 export 4 종(타입 3 + 함수 1)을 정확히 그 이름으로 노출한다. NestJS · Prisma · gateway import 0 (`grep -n "^import" ` 결과에 `@nestjs` · `@prisma` 없음).
- [ ] **happy-path unit test** — public symbol 별 1+ : 서로 다른 점수 3~4 명 입력에서 `cohortSize` · `mean` · `byPerson` 의 `rank` · `percentile` 이 손으로 계산한 기대값과 정확히 일치. 타입 3 종은 반환 객체의 필드 shape 단언으로 cover.
- [ ] **error path unit test** — (i) `entries` 가 `null` / `undefined` 일 때 한국어 메시지의 `TypeError` throw (메시지에 함수명 포함) (ii) 중복 `personId` 입력 시 한국어 `TypeError` throw. 각 1+ 케이스.
- [ ] **분기별 test** — 빈 배열 / cohortSize 1 / 동점 존재 / 동점 없음 / 비-number `metricScore` 절하 / 비유한수(`NaN`·`Infinity`) 절하 각 1+ `it`.
- [ ] **negative case test (예외 분기마다 1+)** — 최소 6 종: ① 동점 뒤 rank 건너뛰기가 실제로 일어남(1,1,3) ② 최하위 `percentile === 0` ③ 동점자의 `percentile` 이 서로 같음 ④ 입력 배열 · 원소가 변형되지 않음(호출 전후 deep-equal) ⑤ 같은 입력 2 회 호출이 deep-equal(결정성) ⑥ 입력 순서를 뒤섞어도 rank · percentile 이 불변이고 동점 내부 순서만 최초 등장 순서를 따름.
- [ ] colocated spec 은 정확히 `src/assessment-evaluation/domain/summary-relative-comparison.spec.ts` 에 둔다 (신규 helper 파일 · `test/helpers/` 추가 0).
- [ ] `pnpm lint && pnpm build && pnpm test` 전부 green.
- [ ] `pnpm test:cov` 통과 — 전역 line ≥ 80% AND function ≥ 80% (`package.json` `coverageThreshold.global`), 신규 파일은 statement · branch · function · line 100%.
- [ ] 기존 파일 무수정 — `git diff --stat` 의 변경 파일이 신규 2 개뿐이다 (`summary-aggregate.ts` · `summary.repository.ts` · `summary.controller.ts` · `docs/requirements.md` · `docs/PLAN.md` 전부 미접촉, task 파일 status 갱신은 별개).
- [ ] [CLAUDE.md](../../CLAUDE.md) `§12` 준수 — 주석 · 에러 메시지 · spec describe/it 문자열은 한국어, 식별자 · 경로는 영어. 행 범위 표기는 `§ 12.76` R1~R7 (구분자 `~`, 단일 행은 `84 행`, `L` prefix 금지).

## Out of Scope

- **배선 일습 금지** — `summary.repository.ts` / `summary.service.ts` / `summary.controller.ts` / DTO 어느 것도 수정하지 않는다. 다중 person 조회 · 신규 endpoint 는 `Follow-ups (a)` 소관 (cap 이중 초과로 분리).
- `summary-aggregate.ts` 의 수식 · 가중치 · 정밀도 변경 (재사용만 하고 손대지 않는다).
- `prisma/schema.prisma` 변경 · migration 신설 (본 helper 는 컬럼을 요구하지 않는다 — 요구했다면 CLAUDE.md `§5` DB schema 게이트로 BLOCKED 대상이다).
- `docs/requirements.md` REQ-036 재판정 · `docs/PLAN.md` checkbox 승격 (PLAN `183 행` once-rule — 배선 머지 뒤 1 회, `Follow-ups (c)`).
- `test/perf/` · `test/load/` · `.github/workflows/` · `package.json` 접촉 (PLAN `157`·`158 행` 게이트).
- LLM narrative 로 상대 비교문을 생성하는 경로 · 프런트(`web/`) 노출 — 별개 축.
- ADR 신설 (본 slice 는 기존 ADR-0035 aggregate 계약 안의 순수 파생 산출이라 새 결정이 없다).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (a) **소비처 배선 (cap 이중 초과로 본 PR 에서 분리 — PLAN `182 행` 예외 조항 적용, 파일 · 심볼 단위 명시)**: ① [`src/user/summary.repository.ts`](../../src/user/summary.repository.ts) 에 좌표 기준 다중 person 조회 (`findByCoordinate(period, periodStart)` — `@@unique([personId, period, periodStart])` index hit) ② `src/user/summary.service.ts` 에서 그 결과를 `computeRelativeComparison` 으로 위임 ③ [`src/user/summary.controller.ts`](../../src/user/summary.controller.ts) 에 조회 endpoint 1 개 (`@Roles("User")` · 기존 `@Get()` 의 RBAC 관행 mirror) ④ query DTO 1 개 ⑤ 위 각각의 colocated spec. 합산 파일 7 · 약 700 LOC 로 2~3 slice 분할 필요.
- (b) `docs/architecture/api.md` 에 (a) 의 endpoint 계약 박제 (배선 머지와 같은 arc 안에서).
- (c) **REQ-036 재판정 1 회** — (a) 배선이 머지된 뒤에만, `docs/requirements.md` `55 행` 1 회 (CLAUDE.md `§3.1` · PLAN `183 행` once-rule). 본 slice 및 (a) 의 중간 단계에서는 재판정하지 않는다.
