---
id: T-1505
title: 실 DB round-trip slice 3(T-1504) 규모 민감도 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 45
estimatedFiles: 3
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1504]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1504 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행 잔여 ② (규모 민감도 미측정) 을 실측 결과로 대체"
---

# T-1505 — 실 DB round-trip slice 3 doc-sync (규모 민감도)

## Why

[T-1504](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) 가 main `a8bc1e28` (PR #1213) 로
머지돼 `test/perf/group-persons-scale-realdb.perf-spec.ts` 가 `GET /api/groups/:id/persons` 를
**membership 5 건(소규모) vs 60 건(대규모)** 두 표본으로 실 Postgres 위에서 측정했다. 그런데
T-1504 의 `## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에
따라 문서 갱신을 **머지 후 별도 direct task** 로 명시 이월했다. 그 결과 3 문서가 아직
**slice 2 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의 잔여 서술은
`T-1503` 이 박제한 **"대규모 membership 에서의 N+1 규모 민감도(membership 수 증가에 따른 latency
기울기)는 미측정"** 을 그대로 달고 있어 **이미 해소된 잔여가 stale 하게 남아 있다**. 본 task 가
그 이월분이며, [T-1501](T-1501-perf-realdb-doc-sync.md) · [T-1503](T-1503-perf-realdb-slice2-doc-sync.md)
이 slice 1 · 2 에 대해 수행한 doc-sync 의 slice 3 판이다.

slice 3 은 **새 endpoint 를 늘리지 않았다** — 측정 route 는 slice 2 와 동일하고 늘어난 것은
**규모 축** 뿐이다. 따라서 본 doc-sync 의 핵심은 개수 증가가 아니라 **잔여 서술의 재조준**
(규모 민감도 잔여를 "`:id/persons` 한 route 에 한해 도달, 다른 endpoint 의 규모 민감도와 REQ-047
실 scale 부하는 여전히 미측정" 으로 좁히는 것) 이다. `test/perf/README.md` 는 T-1504 가 이미
slice 3 항목을 박제했으므로 본 task 는 **인용만** 한다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 3** bullet 과 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md](T-1504-perf-realdb-slice3-njoin-scale-sensitivity.md) —
  측정 범위 (같은 route · 두 규모 표본) · Out of Scope (production code 변경 0 · N+1 최적화 금지 ·
  REQ-047 실 scale 부하 주장 금지) · 대소 assert 금지 사유.
- [test/perf/group-persons-scale-realdb.perf-spec.ts](../../test/perf/group-persons-scale-realdb.perf-spec.ts)
  `50 행` ~ `57 행` (`SMALL_MEMBERS = 5` · `LARGE_MEMBERS = 60` · 반복 횟수 상수) 와 `it(` 목록 —
  문서에 적을 표본 규모·test 수의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **36 개**(그중 read 경로
  **32 개**, T-0830~T-1502)" · "실 DB round-trip 실측이 **slice 2 까지 도달**" · 잔여 절의
  "**대규모 membership 에서의 N+1 규모 민감도** … 미측정" 이 slice 2 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5
  (`134 행` ~ `147 행`) — 갱신 대상 2. "실 DB round-trip 실측이 **slice 2 까지 도달**" 서술과
  "**잔여**: baseline 파일 확정 · 임계 fix · 측정 endpoint 확대" 구절.
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하 문장에 slice 1 · 2 서술과 "실측 범위는 endpoint **2 개 (조회 4 route)**" 가
  들어 있다.
- [T-1503](T-1503-perf-realdb-slice2-doc-sync.md) — 직전 doc-sync 선례. **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts` 를 실행해
  각각 **37** · **32** · **3 파일** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지).
  본문에 쓰는 main SHA 는 `a8bc1e28` (PR #1213), 표본 규모는 spec 상수 실측값 (**5** vs **60**) 이다.
- [ ] **AC 2 — 계수 함정 검산 (본 slice 고유).** slice 3 파일명에는 `read` 가 없어 `*read*` glob
  개수는 **32 로 불변** 이고, 측정 route 도 slice 2 와 동일해 **"mock 잔존 read perf-spec 30 개"
  역시 불변** 이다. 세 문서에서 이 두 수치를 **잘못 증감시키지 않는다** — 대신 전체 perf-spec
  개수만 `36` → `37`, 범위 표기를 `T-0830~T-1502` → `T-0830~T-1504` 로 갱신하고, 불변인 이유
  (파일명 glob · 동일 route) 를 최소 1 곳에 1 구절로 남겨 다음 slice 의 재계산을 돕는다.
- [ ] **AC 3 — PLAN `142 행` 갱신.** ① perf-spec 개수 · 범위 표기를 AC 2 대로 정정, ② "실 DB
  round-trip 실측이 **slice 2 까지 도달**" → **slice 3 까지 도달** 로 확장하고
  `group-persons-scale-realdb.perf-spec.ts` (T-1504, main `a8bc1e28`, 7 test) 가 **같은 route 를
  membership 5 vs 60 두 표본으로 측정해 규모가 커져도 p95 < 3000ms 를 유지함을 실측** 했다는 1 문장
  추가, ③ **잔여 서술에서 "대규모 membership N+1 규모 민감도 미측정" 을 제거** 하고
  "규모 축은 `:id/persons` **한 route 에 한해** 소·대규모 두 표본까지 도달, **다른 endpoint 의 규모
  민감도** 와 REQ-047 실 scale 부하는 여전히 미측정" 으로 **좁혀 재서술**, ④ task 링크 목록에
  T-1504 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 4 — 부하계획 `§ 5` item 5 갱신.** "slice 2 까지 도달" 서술에 slice 3 (T-1504, main
  `a8bc1e28`) 을 **1 ~ 2 문장으로 병기** 하되 **실측 범위는 여전히 `2 endpoint (조회 4 route)`**
  임을 유지하고 (slice 3 은 route 를 늘리지 않았다), 늘어난 것이 **규모 축** 임을 명시한다.
  `**잔여**` 구절에는 "다른 endpoint 의 규모 민감도" 를 추가한다. **"본 item 은 미완" 결론은 그대로
  유지** — `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나
  완화하지 않는다.
- [ ] **AC 5 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 3 을 반영한다 — 파일명 · task · main SHA · **질적 차이(규모 민감도 축)** ·
  두 표본 규모 · "endpoint 수는 2 개로 불변" · 대소 assert 를 하지 않는 관찰 성격. **status 토큰
  `IN_PROGRESS` 는 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" 서술도 불변.
- [ ] **AC 6 — REQ-047 오독 차단.** 세 문서 어디에도 slice 3 의 "대규모(60 membership)" 가
  **REQ-047 실 scale 부하 (100~200명 / 50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는
  표현을 쓰지 않는다. REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 7 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 8 — 범위 표기 규약 준수.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지. **기존 행의 소급 치환은 금지**
  (본 task 는 정규화 task 가 아니다).
- [ ] **AC 9 — 검증 명령.** `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다. 코드 변경이
  0 이므로 test 는 불요하나, `docs/requirements.md` 편집이 표 행 구조 (파이프 구분) 를 깨지 않았는지
  `sed -n '67p' docs/requirements.md` 로 1 행 유지를 확인하고, PLAN 편집이 `142 행` 1 bullet 구조를
  유지하는지 확인한다.

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1504 가 이미 slice 3 항목을 박제했다 — 인용만).
- **perf slice 4 착수** (다른 endpoint 의 실 DB cutover · 다른 route 의 규모 민감도) — 본 task 는
  그 필요를 **문서에 적기만** 하고 실행하지 않는다.
- **N+1 최적화 · production code 변경** — `findPersonsByGroupId` 는 불변. 최적화 판단이 필요하면
  Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 6) — 본 slice 와 무관.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 8).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
