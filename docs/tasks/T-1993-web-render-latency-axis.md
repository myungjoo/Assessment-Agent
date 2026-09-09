---
id: T-1993
title: web 렌더 latency 측정 축 도입 — REQ-048 시각화 축 첫 측정 (helper + 소비처 동반)
phase: P7
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 225
estimatedFiles: 3
estimatedLoc: 225
independentStream: web-render-latency-axis
dependsOn: []
touchesFiles:
  [
    web/src/perf/renderLatency.ts,
    web/src/perf/renderLatency.test.ts,
    web/src/perf/appRender.perf.test.tsx,
  ]
created: 2026-09-09
plannerNote: P7 · PLAN 154 행 잔여 4 축 ④ (시각화 web 렌더 측정 축 부재) — web/src 에 측정 경로가 0 건이라 첫 축을 연다
---

# T-1993 — web 렌더 latency 측정 축 도입 (REQ-048 시각화 축 첫 측정)

## Why

[docs/PLAN.md](../PLAN.md) `154 행` 의 R-92 **잔여 4 축** 중 ④ 가 "시각화(web) 렌더 측정 축 부재" 이고, [docs/requirements.md](../requirements.md) `66~67 행` 의 REQ-048 도 같은 축만 미충족으로 남겨 두고 있다 (조회 측정 harness 축 · CI 강제 축 · 3 초 절대 임계 축은 backend `test/perf/` 로 이미 충족). README `92 행` 은 "로딩 및 **시각화**에 3초 이내" 로 렌더까지 포함하는데, 현재 그 축은 측정 자체가 없다.

**issue-still-relevant pre-check (origin/main `60f9cf3f` 실측)** — ① `git grep -I -c -E "<pat>" origin/main -- 'web/src/**'` 히트가 `performance\.now` **0** · `p95` **0** · `latency` **0** · `Latency` **0** 으로 네 패턴 모두 0 건, ② `git ls-tree origin/main web/src/` 의 최상위 entry 10 개 (`App.tsx` · `AppShell.tsx` · `AuthGate.tsx` · `main.tsx` · `api` · `components` · `styles` · `views` + spec 2) 에 `perf` 디렉토리 **부재**, ③ `git ls-files 'web/src/**/*.test.ts*'` = **140** 개 web test 가 있으나 그중 렌더 소요 시간을 재는 것은 0 개 — 미해소 확인. 본 slice 는 그 축의 **첫 측정 경로**를 열되, 아래 한계 문단대로 축 **완결이 아니다**.

본 slice 는 새 dependency 0 이다 — [web/package.json](../../web/package.json) 의 `vitest` + 이미 [web/src/App.test.tsx](../../web/src/App.test.tsx) 가 쓰는 `react-dom/server` `renderToStaticMarkup` 만 사용한다 (jsdom · testing-library 도입 없음 = ADR-0040 §5 dep 게이트 무저촉). 오너 지시 `158 행` 의 "신규 per-route perf baseline slice 큐잉 금지" 는 backend `test/perf/*.perf-spec.ts` 의 R-92 read-latency 축 상한이며, 본 slice 는 그 축이 아니라 미개시 상태인 ④ 시각화 축이라 저촉하지 않는다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `149 행` (R-92 요약 bullet) · `154 행` (잔여 4 축 ④) · `158 행` (오너 상한의 적용 범위)
- [docs/requirements.md](../requirements.md) `67 행` REQ-048 행 — 충족 3 축과 미충족 1 축의 현행 판정 문장 (재판정은 본 task 범위 밖)
- [web/src/App.test.tsx](../../web/src/App.test.tsx) `1~12 행` — `renderToStaticMarkup` 사용 관행과 "jsdom/@testing-library 없이" 규율 + 파일명 `.test.tsx` 고정 사유
- [web/package.json](../../web/package.json) `scripts` 절 — `test` = `vitest run` (coverage 게이트 없음), `build` = `tsc --noEmit` + `vite build`
- [scripts/check-spec-presence.sh](../../scripts/check-spec-presence.sh) `44~58 행` — 신규 `web/src/**/*.ts` 는 colocated `*.test.ts` 동반 필수
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) `167 행` `DEFAULT_P95_MAX_MS` · `182 행` `assertS2Threshold` — backend 축의 임계 판정 계약 (같은 3000ms 를 web 축에서도 쓰기 위한 참조, import 하지 않는다)
- [.github/workflows/ci.yml](../../.github/workflows/ci.yml) `222~224 행` — `pnpm --filter web test` 가 CI step 이라 본 측정이 즉시 강제됨

## Acceptance Criteria

- [ ] `web/src/perf/renderLatency.ts` 신설 — 순수 helper 로 최소 다음을 export: 렌더 thunk 를 N 회 실행해 `performance.now()` 차분을 모으는 측정 함수, `samples` · `p50` · `p95` · `max` 를 담는 요약 타입, REQ-048 절대 임계 상수 **3000ms**, 그 상수를 기본값으로 쓰는 임계 판정 함수 (`pass` + 실패 사유 문자열). backend `test/perf/` 코드를 import 하지 않는다 (빌드 경계 분리).
- [ ] 임계 판정은 **절대 임계** 이며 직전 회차 대비 상대 회귀는 판정에 쓰지 않는다 — backend `latency-baseline-io.ts` 의 관찰-전용 계약과 동형임을 helper 주석 1~2 줄로 명시.
- [ ] 소비처 동반 (CLAUDE.md §3) — `web/src/perf/appRender.perf.test.tsx` 가 helper 로 `renderToStaticMarkup(<App />)` 렌더 소요를 실제로 측정하고 임계 판정 `pass` 를 단언한다. helper 단독 PR 이 되지 않는다.
- [ ] 소비처 spec 은 markup 이 빈 문자열이 아님도 함께 단언해 "0ms 로 통과하는 빈 렌더" 를 배제한다.
- [ ] happy-path unit test 1+ — colocated `web/src/perf/renderLatency.test.ts` 에서 측정 함수가 `samples` = 요청 횟수이고 `p50 ≤ p95 ≤ max` 인 요약을 반환.
- [ ] error path unit test 1+ — 반복 횟수가 0 · 음수 · 비정수일 때 throw, 렌더 thunk 가 throw 하면 그대로 전파 (삼키지 않음).
- [ ] 분기별 test 1+ — percentile 산출의 인덱스 분기 (표본 1 개 / 짝수·홀수 표본), 임계 판정의 `pass` true·false 두 분기, 임계 인자 기본값 사용 vs 명시 인자 전달 분기 각각 1+.
- [ ] negative case 를 예외 분기마다 1+ — ① 임계 초과 요약에서 `pass=false` 이고 사유 문자열에 `REQ-048` 과 실측 수치가 포함, ② 표본 0 개 요약을 판정에 넘겼을 때의 정의된 동작 (throw 또는 `pass=false`) 이 단언됨, ③ 임계 인자가 `NaN` · 0 이하일 때 거절, ④ 요약 필드 누락 객체를 넘겼을 때 거절.
- [ ] `pnpm --filter web test` 통과 (신규 2 spec 포함 전량 green).
- [ ] `pnpm --filter web build` 통과 (`tsc --noEmit` 타입검사 + `vite build`).
- [ ] root `pnpm lint && pnpm build && pnpm test` 통과 — root jest `testRegex` 는 `*.spec.ts` 라 신규 `.test.ts(x)` 를 집지 않고 root lint 범위 (`{src,test}/**/*.ts`) 도 web 을 포함하지 않음을 실행으로 확인 (backend suite 수 불변).
- [ ] coverage — web vitest 에는 coverage 임계 게이트가 없다 ([web/package.json](../../web/package.json) `"test": "vitest run"`). 따라서 (a) 신규 helper 의 **모든 export 심볼**이 위 4 축 test 를 보유함을 파일 검사로 확인하고, (b) root `pnpm test:cov` 의 line ≥ 80% / function ≥ 80% 임계는 web 이 jest 범위 밖이라 **수치 무변경** 임을 실행으로 확인한다.
- [ ] production 동작 diff 0 — `web/src/App.tsx` · `AppShell.tsx` · `views/` · `api/` 무접촉 (신규 파일 3 개만 추가).
- [ ] helper 주석 또는 소비처 spec 상단에 **측정 한계** 2 문장 박제 — 본 축은 React SSR markup 생성 시간만 재며 브라우저 layout · paint · 네트워크 · 데이터 로딩은 포함하지 않는다, 따라서 REQ-048 시각화 축의 *첫 측정 도입* 이지 축 완결이 아니다.

## Out of Scope

- REQ-048 · REQ-047 의 status 재판정 및 [docs/requirements.md](../requirements.md) 편집 — PLAN `183 행` once-rule 상 구현 머지 **후** 별도 `direct` slice 1 회. 본 task 는 코드만.
- [docs/PLAN.md](../PLAN.md) `154 행` 잔여 4 축 표기 갱신 · checkbox 변경 — 위와 같은 이유로 후속 `direct` slice.
- jsdom · `@testing-library/react` · playwright 등 **신규 dependency 도입** (CLAUDE.md §5 새-dep 게이트 → BLOCKED 대상).
- AdminView 등 대형 view 의 렌더 측정 확대 · route 별 렌더 baseline 파일 체크인 — 본 slice 는 축을 여는 1 개 소비처만.
- backend `test/perf/` 의 spec · primitive · 임계 · baseline 파일 수정, `test/load/` · `load-k6.yml` 접촉.
- R-91 실 수집 왕복 축 (자격증명 필요 — §5 게이트) 과 guard census `KNOWN_GAP_REQ_043` 배선 (auth 변경 — §5 게이트).

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(작성 시점 비어 있음)
