---
id: T-1997
title: PLAN 154 행 ④ 시각화 렌더 측정 축 서술 drift 정정 (T-1995 · T-1996 반영)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-048, REQ-047]
estimatedDiff: 30
estimatedFiles: 1
estimatedLoc: 30
independentStream: web-render-latency-axis
dependsOn: [T-1995, T-1996]
touchesFiles: [docs/PLAN.md]
created: 2026-09-09
plannerNote: P7 · PLAN 154 행 ④ — "3 파일 · SSR markup 한정" 스냅샷이 T-1995·T-1996 머지로 낡음, direct doc-sync 1 건
---

# T-1997 — PLAN 154 행 ④ 시각화 렌더 측정 축 서술 drift 정정

## Why

[docs/PLAN.md](../PLAN.md) `154 행` 의 잔여 4 축 ④ 는 시각화(web) 렌더 측정 축의 근거를 **[T-1993](T-1993-web-render-latency-axis.md) 시점 스냅샷**("`web/src/perf/` **3 파일** 이 App 의 SSR markup 렌더만 재고 브라우저 layout · paint · 네트워크 · **데이터 로딩** 은 미포함") 에 고정해 두고 있다. 그 뒤 [T-1995](T-1995-visualization-component-render-latency.md) (PR #1565 · main `3c6bea7e`) 가 시각화 컴포넌트 3 종을 REQ-047 규모 표본으로, [T-1996](T-1996-data-pipeline-render-latency.md) (PR #1566 · main `366f348b`) 가 "응답 원문 → 매핑 → 필터 → 정렬 → 페이지 slice → 표 markup" 준비 구간을 각각 측정 안으로 넣어 **파일 수도 측정 범위도 바뀌었다**. 즉 ④ 의 판정(`축 완결 미도달`) 자체는 여전히 옳지만 그 **근거 문장이 실측과 어긋난다**. [T-1990](T-1990-plan-e2e-coverage-census-doc-sync.md) 이 e2e census 축에서 한 것과 같은 1 회 drift 정정이다.

**issue-still-relevant pre-check (origin/main `edc82125` 실측)** —

- `git grep -c "T-1995\|T-1996" origin/main -- docs/PLAN.md` → 히트 **0** (출력 없음). PLAN 은 두 slice 를 아직 모른다.
- `git show origin/main:docs/PLAN.md | sed -n '154p' | grep -o "T-199[0-9]"` → `T-1993` **하나뿐**.
- `git ls-tree -r --name-only origin/main web/src/perf` → blob **5 개** (`renderLatency.ts` · `renderLatency.test.ts` · `appRender.perf.test.tsx` · `visualizationRender.perf.test.tsx` · `dataPipelineRender.perf.test.tsx`). PLAN 이 적은 "3 파일" 과 실측 5 가 어긋난다.
- [web/src/perf/dataPipelineRender.perf.test.tsx](../../web/src/perf/dataPipelineRender.perf.test.tsx) `13~23 행` 주석이 실제 덮는 구간과 남은 한계(브라우저 layout · paint · **실제 네트워크 왕복**) 를 명시 — PLAN 이 미포함으로 적은 "데이터 로딩" 중 **클라이언트 준비 구간은 이제 포함**, 네트워크 왕복만 미포함이다.

→ 미해소 확인. 본 task 는 `docs/PLAN.md` 1 파일의 `154 행` 서술만 실측에 맞추고, ④ 의 `축 완결 미도달` 판정과 `155 행` 의 checkbox `[ ]` 유지 근거는 **바꾸지 않는다**. [docs/requirements.md](../requirements.md) `92 행` REQ-048 status 재판정은 §3.1 once-rule 상 [T-1994](T-1994-req048-web-render-axis-doc-sync.md) 가 1 회를 소진했으므로 건드리지 않는다. 오너 지시 `158 행` 상한은 backend `test/perf/*.perf-spec.ts` 의 R-92 축이라 문서 정정인 본 task 와 무저촉이다. 변경 대상이 문서뿐이라 CLAUDE.md §3.1 상 `direct` 다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `154 행` (정정 대상 — 잔여 4 축 ①~④ 한 줄) · `155 행` (오너 결정 승계 · checkbox `[ ]` 유지 근거 — **불변**) · `158 행` (오너 상한의 적용 범위 확인용)
- [docs/tasks/T-1995-visualization-component-render-latency.md](T-1995-visualization-component-render-latency.md) frontmatter `1~16 행` (touchesFiles · coversReq) 와 `## Why` 첫 문단
- [docs/tasks/T-1996-data-pipeline-render-latency.md](T-1996-data-pipeline-render-latency.md) frontmatter `1~16 행` 와 `## Why` 첫 문단
- [web/src/perf/visualizationRender.perf.test.tsx](../../web/src/perf/visualizationRender.perf.test.tsx) `1~13 행` (측정 대상 컴포넌트 3 종 import)
- [web/src/perf/dataPipelineRender.perf.test.tsx](../../web/src/perf/dataPipelineRender.perf.test.tsx) `13~23 행` (덮는 구간 · 잔여 측정 한계 주석 — 정정 문구의 사실 근거)
- [CLAUDE.md](../../CLAUDE.md) §3.1 (direct 판정 근거) · §12 (행 범위 표기 R1~R7 — `~` 구분자 · `154 행` 형식 · `L` prefix 금지)

## Acceptance Criteria

- [ ] `docs/PLAN.md` **1 파일만** 변경한다 — `git diff --name-only` 결과가 `docs/PLAN.md` 단독이고 `src/` · `web/` · `test/` · `docs/requirements.md` diff **0**.
- [ ] `154 행` ④ 의 서술을 실측에 맞춘다: (a) `web/src/perf/` 파일 수를 **5** 로 (b) 근거 slice 를 `T-1993` 단독에서 `T-1993` · `T-1995` · `T-1996` chain 으로 (각각 PR 번호 · main sha `31ff846d` / `3c6bea7e` / `366f348b` 표기) (c) 현 측정이 덮는 범위를 "App 셸 SSR markup" 에서 "App 셸 markup + 시각화 컴포넌트 3 종 + 응답 원문 → 매핑 → 필터 → 정렬 → 페이지 slice → 표 markup 준비 구간" 으로.
- [ ] 같은 문장에서 **잔여 미포함 항목** 을 "브라우저 layout · paint · 실제 네트워크 왕복" 으로 정정한다 — 종전의 "데이터 로딩" 포괄 표현은 클라이언트 준비 구간이 T-1996 으로 들어왔으므로 폐기하고, 미포함이 네트워크 왕복임을 명시한다.
- [ ] ④ 의 결론 판정 문구 **`축 완결 미도달` 은 유지**하고, `155 행` 의 "위 `140 행` checkbox 는 `[ ]` 로 유지한다" 와 ① · ② · ③ 축 서술은 **한 글자도 바꾸지 않는다** (`git diff` 에서 155 행 및 ①~③ 부분 무변경 확인).
- [ ] 정정 문장의 모든 수치·좌표가 실측과 일치함을 다음 명령으로 검증한 뒤 commit 한다: `git ls-tree -r --name-only HEAD web/src/perf | wc -l` = **5**, `git log --oneline -1 3c6bea7e`, `git log --oneline -1 366f348b` 가 각각 T-1995 · T-1996 머지 commit.
- [ ] 행 범위 표기가 CLAUDE.md §12 R1~R7 을 따른다 (`154 행` 형태, 구분자 `~`, `L` prefix 없음).
- [ ] `docs/PLAN.md` 의 마크다운 링크가 깨지지 않는다 — 새로 추가한 task 링크 경로 `tasks/T-1995-visualization-component-render-latency.md` · `tasks/T-1996-data-pipeline-render-latency.md` 가 실제 파일로 해석되는지 `ls` 로 확인.
- [ ] doc-only direct commit 이므로 §3.2 R-110 상 tester 면제 — 코드·CI·의존성 변경이 0 임을 `git diff --stat` 으로 확인한다.

## Out of Scope

- [docs/requirements.md](../requirements.md) `92 행` REQ-048 · `91 행` REQ-047 의 status 재판정 (§3.1 once-rule — T-1994 가 소진).
- `154 행` ①(read perf-spec 30 개 cutover) · ②(baseline 임계 fix) · ③(REQ-047 실 scale) 축 서술 수정 — 각 축의 실측이 바뀐 근거가 없다.
- `140 행` · `155 행` checkbox 승격 (`[ ]` → `[x]`) — ④ 는 여전히 축 완결 미도달이다.
- `web/src/perf/` 파일 신설·수정, 신규 측정 slice 착수 (본 task 는 문서 정정 전용).
- `test/perf/README.md` · `docs/ops/load-resilience-test-plan.md` 갱신 — backend R-92 축 정본이라 본 정정 대상 아님.
- 신규 ADR 작성 또는 기존 ADR 결정 내용 변경 (그 경우 commitMode 가 `pr` 로 갈린다).
- PLAN 의 다른 bullet prune · 재구성.

## Suggested Sub-agents

`implementer`

## Follow-ups

- (없음 — ④ 축의 다음 확장 slice 는 브라우저 layout · paint 측정이 필요해 신규 dependency 게이트(§5) 를 먼저 통과해야 한다.)
