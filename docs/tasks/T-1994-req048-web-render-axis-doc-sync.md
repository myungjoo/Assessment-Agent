---
id: T-1994
title: REQ-048 · PLAN 154 행 ④ 의 web 렌더 측정 축 판정 doc-sync (T-1993 머지 반영)
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 12
estimatedFiles: 2
estimatedLoc: 12
independentStream: req048-web-axis-doc-sync
dependsOn: [T-1993]
touchesFiles: [docs/requirements.md, docs/PLAN.md]
created: 2026-09-09
plannerNote: P7 · §3.1 once-rule — T-1993 머지 후 REQ-048 · PLAN 154 행 ④ 의 "측정 축 부재" drift 를 실측으로 정정
---

# T-1994 — REQ-048 · PLAN 154 행 ④ web 렌더 측정 축 판정 doc-sync

## Why

[T-1993](T-1993-web-render-latency-axis.md) (PR #1564 → main `31ff846d`) 이 REQ-048 시각화 축의 **첫 측정 경로**를 열었는데, 그 task 의 `## Out of Scope` 가 REQ status 재판정과 PLAN 표기 갱신을 명시적으로 후속 `direct` slice 로 남겼다. CLAUDE.md `§3.1` 의 "REQ status 재판정 task 는 구현 slice 가 머지된 뒤 REQ 당 1 회만" 조건이 이제 충족되므로 본 slice 가 그 **1 회**다.

**issue-still-relevant pre-check (origin/main `9b42093a` 실측)**

- ① 구현은 main 에 안착 — `git ls-tree origin/main web/src/perf/` 가 `renderLatency.ts` · `renderLatency.test.ts` · `appRender.perf.test.tsx` **3 blob** 을 반환한다 (T-1993 시점에는 `perf` 디렉토리 자체가 부재였다).
- ② 문서의 근거 수치가 뒤집혔다 — `git grep -I -l -E <pat> origin/main -- 'web/src'` 파일 히트가 `performance.now` **2** · `p95` **3** · `latency|Latency` **3** · `REQ-048` **3** 이다. [docs/requirements.md](../requirements.md) `67 행` 은 아직 "3 패턴을 `grep -rn` 으로 찾은 결과가 **0 건**" · "측정하는 경로가 **전무**" 로 적고 있다.
- ③ drift 가 미해소다 — `git log 31ff846d..origin/main -- docs/requirements.md docs/PLAN.md` 가 **0 commit** 이라 T-1993 머지 이후 두 문서 모두 무수정이다.
- ④ 정정 대상 지점은 정확히 4 곳 — `67 행` 안에서 `시각화(web) 렌더 측정 축 부재` **2 회** (판정 머리말 1 + "부재는 불변" 문장 1) + 위 ② 의 "0 건 / 전무 / 측정 미도입" 문단 1 곳, 그리고 [docs/PLAN.md](../PLAN.md) `154 행` 의 잔여 4 축 ④ 1 곳.

status enum 자체는 **IN_PROGRESS 유지**다 — T-1993 은 React SSR markup 생성 시간만 재고 브라우저 layout · paint · 네트워크 · 데이터 로딩을 포함하지 않아 (T-1993 AC 의 "측정 한계" 2 문장) 축 완결이 아니다. 본 slice 는 "부재" → "부분 개시(한정 범위)" 로 판정 문구만 실측에 맞춘다.

## Required Reading

- [docs/requirements.md](../requirements.md) `67 행` — REQ-048 행 (단일 행 `58,471 자` mega-row). 정정 대상 3 곳은 위 `## Why` ④ 의 문자열로 검색해 찾는다. **행 전체 재작성 금지, 해당 문장만 치환.**
- [docs/PLAN.md](../PLAN.md) `154 행` (잔여 4 축) · `155 행` (checkbox `[ ]` 유지 근거) · `149 행` (R-92 요약 머리말)
- [docs/tasks/T-1993-web-render-latency-axis.md](T-1993-web-render-latency-axis.md) `## Acceptance Criteria` 마지막 bullet — 박제해야 할 **측정 한계** 2 문장의 정본 표현
- [web/src/perf/renderLatency.ts](../../web/src/perf/renderLatency.ts) — export 심볼명과 `3000ms` 임계 상수 (문서에 인용할 근거)
- [web/src/perf/appRender.perf.test.tsx](../../web/src/perf/appRender.perf.test.tsx) — 소비처가 무엇을 실제로 재는지 (SSR markup 렌더 1 경로)
- [CLAUDE.md](../../CLAUDE.md) `§3.1` (REQ 재판정 once-rule) · `§12` 행 범위 표기 규칙

## Acceptance Criteria

- [ ] [docs/requirements.md](../requirements.md) `67 행` 판정 머리말의 `시각화(web) 렌더 측정 축 부재` 가 **부분 충족 표현**으로 바뀐다 — 무엇이 생겼고(첫 측정 경로) 무엇이 남았는지(축 완결 아님) 가 한 구절에 함께 읽힌다.
- [ ] 같은 행의 "`web/src` 에서 3 패턴 … **0 건** … 경로가 **전무**하다 … 측정 **미도입**" 문단이 실측으로 교체된다 — `web/src/perf/` **3 파일**, 파일 히트 `performance.now` **2** · `p95` **3** · `latency` **3**, 근거 commit `31ff846d`(PR #1564) 를 포함한다.
- [ ] 같은 행의 `**시각화(web) 렌더 측정 축 부재는 불변**` 문장이 정정되고, 그 자리에 **측정 한계** 가 1~2 문장으로 박제된다 (SSR markup 생성 시간만 측정 · layout · paint · 네트워크 · 데이터 로딩 미포함 → 축 *완결* 아님).
- [ ] REQ-048 의 status 값은 **`IN_PROGRESS` 그대로** 다 (변경 시 AC 위반). REQ-047 행 `66 행` 은 **무접촉**.
- [ ] [docs/PLAN.md](../PLAN.md) `154 행` 의 ④ 가 "시각화(web) 렌더 측정 축 부재" → "첫 측정 경로 개시(SSR markup 한정) · 축 완결 미도달" 취지로 갱신되고, `155 행` 의 checkbox `[ ]` 유지 근거는 **불변**이다 (잔여 4 축이 여전히 살아 있음).
- [ ] 검증 명령 — `grep -c "시각화(web) 렌더 측정 축 부재" docs/requirements.md docs/PLAN.md` 가 두 파일 모두 **0**, `grep -c "31ff846d" docs/requirements.md` 가 **1 이상**.
- [ ] 변경 파일이 정확히 2 개 — `git diff --name-only` 가 `docs/requirements.md` 와 `docs/PLAN.md` 만 출력 (task status · journal · STATE 는 driver bookkeeping 몫).
- [ ] `§12` 행 범위 표기 준수 — 신규 작성 구절에서 구분자 `~`, 단일 행은 `67 행` 형태, `L` prefix 금지.
- [ ] R-112 4 축(happy / error / 분기 / negative) 은 **적용 대상 아님** — 본 task 는 production 코드 0 LOC 의 `direct` doc-only 이며, R-110 의 `pnpm lint && pnpm build && pnpm test` 도 doc-only 면제 대상이다. 대신 위 grep 2 종이 검증면을 대신한다.
- [ ] 문서 diff 가 `§3` cap 안 — 두 파일 합계 변경 행 수 ≤ 10 행 (mega-row 는 행 단위 치환 1 회로 처리).

## Out of Scope

- REQ-047 (`66 행`) 재판정 · 실 scale 부하 서술 수정 — 본 slice 는 REQ-048 만.
- [docs/PLAN.md](../PLAN.md) `140 행` · `155 행` checkbox 를 `[x]` 로 flip — 잔여 4 축(①②③) 이 살아 있어 근거 없음.
- `web/src/perf/` 측정 확대 (AdminView 등 대형 view · route 별 렌더 baseline · jsdom 도입) 및 backend `test/perf/` · `test/load/` 접촉.
- [README.md](../../README.md) `92 행` 문구 수정, 새 ADR 신설, [test/perf/README.md](../../test/perf/README.md) 갱신.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 잔여 route 인벤토리 갱신 (별도 축).
- `docs/PLAN.md` R-92 요약 bullet 의 재압축 · 구조 재작성 (T-1707 이 이미 정본화).

## Suggested Sub-agents

`implementer` (doc-only — tester 불필요, R-110 면제 근거는 AC 참조)

## Follow-ups

(작성 시점 비어 있음)
