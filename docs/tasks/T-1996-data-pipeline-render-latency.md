---
id: T-1996
title: 표시 파이프라인 렌더 latency 측정 — payload 매핑 → 필터 → 정렬 → 표 렌더 (REQ-047 규모)
phase: P7
status: DONE
commitMode: pr
coversReq: [REQ-048, REQ-047]
estimatedDiff: 265
estimatedFiles: 1
estimatedLoc: 265
independentStream: web-render-latency-axis
dependsOn: [T-1993, T-1995]
touchesFiles: [web/src/perf/dataPipelineRender.perf.test.tsx]
created: 2026-09-09
plannerNote: P7 · PLAN 154 행 ④ — markup-only 측정을 payload 매핑·필터·정렬 포함 표시 파이프라인 구간으로 확장
---

# T-1996 — 표시 파이프라인 렌더 latency 측정 (payload → 매핑 → 필터 → 정렬 → 표 렌더)

## Why

[docs/PLAN.md](../PLAN.md) `154 행` 잔여 4 축 ④ 는 아직 "**첫 측정 경로 개시(SSR markup 한정) · 축 완결 미도달**" 이며, 명시된 미포함 항목이 "브라우저 layout · paint · 네트워크 · **데이터 로딩**" 이다. 이 중 layout · paint · 네트워크는 jsdom · 브라우저 · 신규 dependency 없이는 잴 수 없지만, **데이터 로딩 후 화면에 닿기까지의 클라이언트 측 준비 구간**(응답 원문 → 표시 행 매핑 → 검색 필터 → 정렬 → 페이지 slice → 표 렌더) 은 지금 있는 순수 모듈만으로 측정 가능하고, [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `632~639 행` 이 실제 production 조합 순서다. 현재 측정은 이미 매핑이 끝난 행 배열을 컴포넌트에 넣은 지점부터라(= [T-1995](T-1995-visualization-component-render-latency.md)) 이 준비 구간이 통째로 계측 밖에 있다. 본 slice 는 그 구간을 REQ-047 규모(200 명분 응답 원문)로 재서 축을 "markup-only" 에서 "payload → 화면" 구간으로 넓힌다.

**issue-still-relevant pre-check (origin/main `e620b3e0` 실측)** —

- `git ls-tree -r --name-only origin/main web/src/perf` = **4 blob** (`renderLatency.ts` · `renderLatency.test.ts` · `appRender.perf.test.tsx` · `visualizationRender.perf.test.tsx`) — 파이프라인 구간 측정 파일 **부재**.
- `git grep -c "deriveAssessmentDisplayRows\|filterAssessmentRows\|sortAssessmentRows" origin/main -- web/src/perf` 매칭 파일 **0 개** — 매핑 · 필터 · 정렬 함수가 perf 측정에 한 번도 들어간 적 없음.
- `git ls-tree -r --name-only origin/main web/src | grep -i "pipeline\|dataflow"` **0 건** — 동명·유사 목적 파일 없음.
- `git grep -c "deriveAssessmentDisplayRows" origin/main -- web/src` 호출 지점은 `assessmentRow.ts`(정의 1) · `assessmentRow.test.ts`(15) · `DashboardView.tsx`(3) · `DashboardView.test.tsx`(1) 뿐 — 전부 동작 검증이고 **소요 시간을 재는 곳 0**.
- `git grep -l "measureRenderLatency" origin/main -- web/src` = `web/src/perf/` **4 파일뿐** — 소비처가 perf 디렉토리를 벗어난 적 없음.

→ 미해소 확인. 본 slice 는 helper 를 신설하지 않고 T-1993 이 머지한 `measureRenderLatency` / `assertRenderThreshold` 의 **세 번째 소비처**만 추가하므로 §3 소비처 동반 의무에 저촉하지 않는다. 오너 지시 [docs/PLAN.md](../PLAN.md) `158 행` 의 "신규 per-route perf baseline slice 큐잉 금지" 는 backend `test/perf/*.perf-spec.ts` 의 R-92 read-latency 축 상한이라 web 시각화 축 ④ 인 본 slice 와 무저촉이다(T-1993 · T-1995 와 동일 근거). 새 dependency 0 — 기존 `vitest` + `react-dom/server` 만 쓴다. REQ status 재판정은 [T-1994](T-1994-req048-web-render-axis-doc-sync.md) 가 §3.1 once-rule 의 1 회를 소진했으므로 본 task 는 [docs/requirements.md](../requirements.md) 를 건드리지 않는다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `154 행` (잔여 4 축 ④ 현행 판정과 미포함 항목 문장) · `158 행` (오너 상한의 적용 범위)
- [docs/requirements.md](../requirements.md) `66 행` REQ-047 (규모 근거 100~200명) · `67 행` REQ-048 (3 초 임계 근거)
- [web/src/perf/renderLatency.ts](../../web/src/perf/renderLatency.ts) `17 행` `REQ048_RENDER_MAX_MS` · `62~90 행` `measureRenderLatency(render, iterations, opts)` (thunk 예외 전파 · `iterations` 1 이상 정수) · `100~132 행` `assertRenderThreshold` (표본 0 은 `pass=false`, 초과 시 `reason` 문자열)
- [web/src/perf/visualizationRender.perf.test.tsx](../../web/src/perf/visualizationRender.perf.test.tsx) `1~40 행` — 직전 소비처의 작성 관행(파일명 `.perf.test.tsx` 로 root jest testRegex 회피 · 측정 한계 주석 · `countOf` 로 빈 렌더 위장 배제)
- [web/src/views/DashboardView.tsx](../../web/src/views/DashboardView.tsx) `632~639 행` — production 파이프라인 조합 순서 `sortAssessmentRows(filterAssessmentRows(deriveAssessmentDisplayRows(data), searchTerm), sortKey, sortDirection)` · `669~673 행` `pageRows(visibleRows, page, pageSize)` · `962~978 행` 테스트용 export 블록(`pageRows` 포함)
- [web/src/api/assessmentRow.ts](../../web/src/api/assessmentRow.ts) `14~28 행` `AssessmentDisplayRow` 9 키 · `57 행` `parseNumericField` · `83 행` `toAssessmentDisplayRow`(매핑 실패 시 `null`) · `112 행` `deriveAssessmentDisplayRows`(비배열이면 빈 배열, 결손 원소만 제외)
- [web/src/api/assessmentRowOps.ts](../../web/src/api/assessmentRowOps.ts) `73 행` `filterAssessmentRows(rows, searchTerm)`(빈 검색어면 전체 복사 · 문자열 축 5 개 대소문자 무시 부분 일치 · 비배열이면 빈 배열) · `106 행` `sortAssessmentRows(rows, sortKey, sortDirection)`(숫자 축 `null` 은 방향 무관 마지막 · 미지원 키는 입력 순서 보존)
- [web/src/components/AssessmentResultTable.tsx](../../web/src/components/AssessmentResultTable.tsx) `60~74 행` — props(`rows` 필수 · `sortKey` · `sortDirection` · `loading` · `emptyMessage`) 와 loading 우선 정책
- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) `44~58 행` — 신규 `web/src/**` 파일의 colocated spec 규칙(본 파일은 자체가 test 라 T-1993 · T-1995 선례대로 통과)

## Acceptance Criteria

- [ ] 신규 파일 [web/src/perf/dataPipelineRender.perf.test.tsx](../../web/src/perf/dataPipelineRender.perf.test.tsx) **1 개만** 추가한다. 상단 주석에 (1) 본 측정이 덮는 구간(응답 원문 → 매핑 → 필터 → 정렬 → 페이지 slice → 표 markup) 과 (2) 여전한 측정 한계(브라우저 layout · paint · 실제 네트워크 왕복 미포함) 를 T-1995 와 같은 취지로 명시한다.
- [ ] **happy-path (R-112 ①)** — REQ-047 인원 상한을 반영한 **200 건 응답 원문**(`unknown[]` 형태의 raw JSON 유사 객체) 을 입력으로, 파이프라인 전 구간을 하나의 thunk 로 묶어 `measureRenderLatency` 로 반복 측정하고 `assertRenderThreshold` 의 `pass === true` · `reason === ''` · `summary.samples` 를 단언하는 it 1+.
- [ ] **단계 귀속 (R-112 ①)** — 파이프라인 각 단계(매핑 / 필터+정렬 / 표 렌더) 를 개별 thunk 로도 측정해 단계별 `pass === true` 를 단언하는 it 각 1+ (총 3 개 이상). 어느 단계가 임계를 먹는지 회귀 시 특정 가능하게 한다.
- [ ] **빈 렌더 위장 배제 (R-112 ④)** — 전 구간 측정에서 마지막 markup 이 `''` 가 아니고 규모가 실제로 렌더됐음을 markup 토큰 개수로 센다(예: `<tr>` 개수 = 헤더 1 + 표시 행 수, 셀 개수 = 표시 행 수 × 컬럼 6). 매핑된 행 수(`deriveAssessmentDisplayRows` 결과 길이) 도 함께 단언한다.
- [ ] **분기 (R-112 ③)** — 최소 다음 분기를 각각 측정하는 it 1+: (a) 검색어 없음(전체 통과) 대 검색어 있음(부분 일치로 행 수 감소) (b) 정렬 `asc` 대 `desc` (c) 숫자 축 `null` 행이 방향과 무관하게 마지막에 오는 순서 (d) `loading: true` 표 렌더(행 미표시). 각 분기에서 임계 판정이 `pass === true` 이고 결과 행 수·순서가 기대와 일치함을 단언한다.
- [ ] **negative — 비정상 payload (R-112 ④)** — 예외 분기마다 it 1+: (a) 비배열 payload(`null` · `undefined` · 객체 · 문자열) 는 빈 표로 흡수되고 측정이 throw 하지 않음 (b) 결손·타입 위반 원소가 섞인 payload 는 유효 행만 남고 나머지가 조용히 유실되지 않음(매핑 성공 수를 명시 단언) (c) 숫자 축에 `NaN` · `Infinity` · `null` 이 든 행이 `'—'` 로 흡수되고 `'NaN'` · `'undefined'` 문자열이 markup 에 새지 않음 (d) 미지원 정렬 키가 들어와도 입력 순서가 보존됨 (e) 정규식 메타문자(`.` · `*` · `[`) 검색어가 리터럴로 취급되어 throw 하지 않음.
- [ ] **error path (R-112 ②)** — 파이프라인 thunk 가 throw 하는 경우 `measureRenderLatency` 가 예외를 삼키지 않고 전파함을 본 소비처 맥락에서 단언하는 it 1+, 그리고 `assertRenderThreshold` 가 표본 0 요약에 대해 `pass === false` 이고 `reason` 이 빈 문자열이 아님을 단언하는 it 1+.
- [ ] `cd web && pnpm test` 전량 green — 기존 web test 파일 **146 개** 가 147 개가 되고 회귀 0.
- [ ] `cd web && pnpm build` (`tsc --noEmit` + `vite build`) 통과 — 새 파일 타입 오류 0.
- [ ] repo root `pnpm lint && pnpm build && pnpm test` 통과(backend 무영향) 이며 `pnpm test:cov` 가 line ≥ 80% · function ≥ 80% 게이트를 유지한다.
- [ ] `git diff --stat` 상 변경 파일이 신규 1 개뿐이고 `src/` · `test/` · `docs/` · `web/src/api/` · `web/src/components/` · `web/src/views/` diff **0**.

## Out of Scope

- `web/src/perf/renderLatency.ts` 수정 — helper 계약은 T-1993 대로 고정, 본 slice 는 소비처만 추가한다.
- `DashboardView` · `AdminView` 컨테이너 자체의 렌더 측정 — hook · fetch 경로가 얽혀 별도 slice(T-1995 Out of Scope 승계). 본 slice 는 컨테이너에서 **순수 export(`pageRows`) 만** 빌려 쓴다.
- jsdom · `@testing-library` · k6 등 신규 dependency 도입 (필요 시 ADR + 오너 승인 경로).
- 실제 네트워크 왕복 · MSW 류 fetch mocking 도입 — 본 slice 는 in-process 준비 구간만 잰다.
- `test/perf/baselines/` 류 체크인 baseline 파일 생성 · 상대 회귀 임계 도입 (ADR-0056 축).
- [docs/requirements.md](../requirements.md) REQ-047 / REQ-048 status 재판정 — §3.1 once-rule 상 T-1994 가 1 회를 소진했다.
- backend `test/perf/*.perf-spec.ts` 추가 · 수정 (오너 `158 행` 상한).
- 측정 대상 production 모듈(`assessmentRow.ts` · `assessmentRowOps.ts` · `AssessmentResultTable.tsx`) 의 코드 수정.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

- (머지 후) [docs/PLAN.md](../PLAN.md) `154 행` ④ 서술을 T-1995 · T-1996 반영으로 direct doc-sync — 단 REQ status 재판정은 once-rule 소진이므로 PLAN 문장만 손댄다.
