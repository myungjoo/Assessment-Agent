---
id: T-1732
title: web 조회 기간 지정 request 순수 모듈 evaluationPeriod 신설
phase: P6
status: PENDING
commitMode: pr
coversReq: [REQ-077]
estimatedDiff: 265
estimatedFiles: 2
independentStream: p6-dashboard-period
dependsOn: []
touchesFiles:
  - web/src/api/evaluationPeriod.ts
  - web/src/api/evaluationPeriod.test.ts
created: 2026-08-27
plannerNote: PLAN 131 행 ④(REQ-077) 분해 slice 1 — 기간 지정 request 계약을 순수 모듈로 먼저 박제, UI·배선은 후속.
---

# T-1732 — web 조회 기간 지정 request 순수 모듈 evaluationPeriod 신설

## Why

오너 지시 [PLAN](../PLAN.md) `131 행` 의 ① (인원 선택 UI, T-1722·T-1723) · ② (표시 계약 정합, T-1724~T-1727) · ③ (실 metricScore 스케일, T-1728~T-1731) 은 모두 머지돼 닫혔다. 남은 항목은 **④ 기간(일/주/월 + 시작 시점) 지정 UI + `POST /api/assessment-evaluation/period` 호출 경로 배선** = [requirements.md](../requirements.md) **REQ-077** 뿐이므로 본 stream 을 이어간다. 실측 근거: `web/src` 전체에서 `assessment-evaluation` endpoint 참조가 **0 건** 이라 프런트 기간 지정 경로는 아직 존재하지 않는다 ([api.md](../architecture/api.md) `212 행` 의 "프런트 기간 지정 UI 부재" 잔여 기록과 일치).

④ 전체(요청 계약 + 선택 UI 컴포넌트 + DashboardView 배선 + 실 POST 호출)는 §3 상한(300 LOC / 5 파일)을 크게 넘긴다. 그래서 T-1728(순수 모듈 선행) → T-1729/T-1730(배선) 선례를 승계해 **slice 1 = 요청 계약 순수 모듈만** 으로 자른다. 본 slice 는 backend `PeriodBridgeDto` 의 5 키 계약을 프런트 쪽에 단일 지점으로 박제해, 후속 UI slice 가 body 조립을 재발명하지 않게 한다.

## Required Reading

- [src/assessment-evaluation/dto/period-bridge.dto.ts](../../src/assessment-evaluation/dto/period-bridge.dto.ts) — 요청 body 정본 계약(`personId` / `period` / `scope` / `periodStart` / `reevaluate?`, whitelist + forbidNonWhitelisted).
- [docs/architecture/api.md](../architecture/api.md) `104 행` — `POST /api/assessment-evaluation/period` 의 경로 · role 분기 · 허용 literal(period = day/week/month, scope = commit/document/aggregate) · error 매핑.
- [src/common/period-boundary.ts](../../src/common/period-boundary.ts) `267~320 행` — `ISO_INPUT_PATTERN` 과 `parseKstPeriodInput`. 날짜만(`YYYY-MM-DD`) 입력이 허용되며 backend 가 KST 자정으로 해석한다는 사실의 근거(프런트에서 offset 산술 금지의 근거이기도 하다).
- [web/src/api/assessmentScoreScale.ts](../../web/src/api/assessmentScoreScale.ts) — 본 slice 가 따라야 할 **순수 모듈 스타일 선례**(react·fetch·컴포넌트 import 0, throw 0, 입력 mutation 0, 파일 머리 주석에 근거 박제).
- [web/src/api/assessmentScoreScale.test.ts](../../web/src/api/assessmentScoreScale.test.ts) — colocated spec 의 describe 구성 · drift guard 작성 선례.

## Acceptance Criteria

- [ ] 신규 파일 `web/src/api/evaluationPeriod.ts` (**colocated spec 은 `web/src/api/evaluationPeriod.test.ts`**) 에 다음 surface 를 export 한다. 파일 머리 주석에 "계약 정본은 backend `PeriodBridgeDto` / api.md `104 행`" 을 명시한다.
  - `PERIOD_EVALUATION_PATH` — `'/api/assessment-evaluation/period'` 상수.
  - `EvaluationPeriodGranularity` — `'day' | 'week' | 'month'` union type.
  - `EVALUATION_PERIOD_OPTIONS` — `{ value, label }` readonly 배열(라벨은 한국어: 일간 / 주간 / 월간). 후속 select UI 의 option source.
  - `DEFAULT_EVALUATION_SCOPE` — `'aggregate'` 상수(api.md `104 행` 허용 literal 중 대시보드 기본값).
  - `isEvaluationPeriodGranularity(value: unknown): value is EvaluationPeriodGranularity` — 허용 literal 3 종만 true.
  - `normalizePeriodStartInput(value: unknown): string | null` — `<input type="date">` 값(`YYYY-MM-DD`)을 trim 해 반환하고, 형식 위반 · 달력상 불가능한 날짜 · 비문자열 · 빈 문자열은 `null`.
  - `buildPeriodEvaluationRequest(input): { path, body } | null` — 유효 입력이면 요청 path 와 body 를, 하나라도 무효면 `null`.
- [ ] `normalizePeriodStartInput` 은 **offset 산술을 하지 않는다** — `+09:00` 같은 offset 문자열을 프런트에서 조립하지 말고 날짜 문자열을 그대로 통과시킨다(KST 해석은 backend `parseKstPeriodInput` 책임). 이 근거를 주석 1~2 줄로 박제한다.
- [ ] `buildPeriodEvaluationRequest` 의 body 는 **`personId` / `period` / `scope` / `periodStart` 4 키 + `reevaluate` 가 엄격히 `true` 일 때만 추가된 5 번째 키** 만 갖는다. 입력 객체에 정의 외 키가 섞여 있어도 body 로 새어나가지 않는다(backend `forbidNonWhitelisted` 400 사전 차단).
- [ ] 순수성 유지 — `react` · `components/*` · `apiClient` · `fetch` import 0, throw 0, 입력 인자 mutation 0.
- [ ] `web/src/api/evaluationPeriod.test.ts` (colocated) 에 R-112 4 종을 모두 담는다:
  - **happy-path**: 각 public symbol 1+ — `isEvaluationPeriodGranularity('day'|'week'|'month')` true, `normalizePeriodStartInput('2026-08-01')` 통과, `buildPeriodEvaluationRequest` 가 정상 입력에서 기대 path·body 를 반환, `EVALUATION_PERIOD_OPTIONS` 가 3 종을 순서대로 담고 한국어 라벨을 가짐.
  - **error path**: 무효 입력에서 **throw 하지 않고** `null` 을 반환함을 단언(`expect(() => ...).not.toThrow()` 포함).
  - **분기 cover**: `reevaluate` 미지정 / `false` / `true` 3 분기 각 1+ (true 일 때만 body 에 키가 존재), `scope` 미지정(기본값 적용) / 명시 2 분기.
  - **negative cases 충분 cover — 각 1+**: (a) `personId` 가 빈 문자열/공백만, (b) `personId` 비문자열, (c) `period` 가 허용 밖(`'year'`), (d) `period` 대소문자 위반(`'DAY'`), (e) `periodStart` 달력상 불가능(`'2026-02-30'`), (f) `periodStart` zero-pad 누락(`'2026-8-1'`), (g) `periodStart` 빈 문자열, (h) `null` / `undefined` 입력, (i) 입력 객체의 정의 외 키가 body 로 새지 않음.
  - **drift guard 1+**: body 키 집합이 backend 계약 5 키를 벗어나지 않음을 `Object.keys` 로 단언(계약 확장 시 fail 로 드러남).
- [ ] `pnpm --dir web test` (vitest) 전량 green — 신규 spec 포함.
- [ ] `pnpm --dir web build` (tsc) green.
- [ ] 루트 `pnpm lint` green, `pnpm test:cov` green (line ≥ 80% / function ≥ 80%). `src/` diff 0 이므로 backend coverage 는 불변이어야 한다.
- [ ] 변경 파일 2 개 / diff ≤ 300 LOC 를 지킨다(초과 예상 시 spec 케이스를 합치지 말고 planner 에게 split 을 남긴다).

## Out of Scope

- `web/src/views/DashboardView.tsx` · `web/src/AppShell.tsx` 변경 — 배선은 후속 slice.
- 기간 선택 **컴포넌트**(`DashboardPeriodSelector` 등) 신설 — 별도 slice.
- 실 `POST` 호출 / `apiClient.request` 사용 / 응답 타입(`EvaluationResult[]` · `PeriodBridgeAdminResponse`) 매핑 — 본 slice 는 요청 조립까지만.
- `src/` · `prisma/` · `docs/architecture/*` · `package.json` 변경, 새 dependency 추가.
- 기존 `period` prop 을 쓰는 `buildAssessmentsPath` · `buildSummariesPath`(조회 계열) 수정 — 본 모듈은 평가 발화 계열만 다룬다.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (후속 slice) `DashboardPeriodSelector` 컴포넌트 신설 — `EVALUATION_PERIOD_OPTIONS` + `<input type="date">` 소비, 순수 presentational.
- (후속 slice) DashboardView 배선 + `POST /api/assessment-evaluation/period` 실 호출 · 응답 반영 · 실패 표시.
