---
id: T-1503
title: 실 DB round-trip slice 2(T-1502) 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 50
estimatedFiles: 3
created: 2026-08-05
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1502]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1502 Out of Scope 가 머지 후로 미룬 direct doc-sync — PLAN 142 행 · 부하계획 § 5 item 5 · REQ-048 재판정 3 지점의 slice 1 전제 서술 갱신"
---

# T-1503 — 실 DB round-trip slice 2 doc-sync

## Why

[T-1502](T-1502-perf-realdb-group-read-njoin.md) 가 main `97198504` (PR #1212) 로 머지돼
`test/perf/group-read-realdb.perf-spec.ts` 가 `GET /api/groups` 목록 + `:id/persons` 의
**N+1 indirect navigation** 경로 p95 를 실 Postgres 위에서 실측했다. 그러나 T-1502 의
`## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라
문서 갱신을 **머지 후 별도 direct task** 로 명시 이월했고, 그 결과 현재 3 문서가 아직
**slice 1 (endpoint 1 개) 전제** 로 서술돼 있다. 본 task 가 그 이월분이다 —
[T-1501](T-1501-perf-realdb-doc-sync.md) 이 slice 1 에 대해 수행한 동형 doc-sync 의 slice 2 판.

정합 대상은 세 지점이다: [PLAN.md](../PLAN.md) `142 행` P7 성능검증 sub-bullet (perf-spec 개수 ·
"첫 실측 도달" 서술 · 잔여 사유), [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
`§ 5` item 5 (실측 도달 범위), [requirements.md](../requirements.md) REQ-048 재판정 (실 DB 축
"부분 해소" 의 범위와 잔여 mock spec 수). 여기에 더해 `test/perf/README.md` 의 절 제목이
T-1502 에서 `## 실 DB round-trip baseline (첫 slice)` → `## 실 DB round-trip baseline (slice 목록)`
으로 바뀌었으므로 세 문서가 인용한 **옛 제목 pointer 가 stale** 이다 — 함께 정정한다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `508 행` ~ `540 행` (`## 실 DB round-trip
  baseline (slice 목록)`) — 갱신의 **정본 근거**. slice 1 / 책임 경계 / slice 2 / 잔여 / 로컬 실행
  전제 / 임계 불변 6 bullet. 본 task 는 이 파일을 **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1502-perf-realdb-group-read-njoin.md](T-1502-perf-realdb-group-read-njoin.md) —
  측정 범위 (조회 3 route) · Out of Scope (production code 변경 0 · N+1 최적화 금지) · Follow-ups.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **35 개**(그중 read 경로
  **31 개**, T-0830~T-1500)" · "**실 DB round-trip 첫 실측 도달**" · "실측 범위가 endpoint **1 개**
  뿐이고 나머지 read perf-spec **30 개**" 세 수치·서술이 slice 1 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5
  (`134 행` ~ 절 끝) — 갱신 대상 2. "**첫 실 DB round-trip 실측 도달**(T-1500 …) … `GET /api/persons`
  **1 endpoint**" 서술.
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하 문장에 endpoint **1 개** · "나머지 read perf-spec 30 개는 여전히 mock service
  기반" · README 절 제목 인용이 들어 있다.
- [T-1501](T-1501-perf-realdb-doc-sync.md) — slice 1 doc-sync 선례. **완료 선언 금지 · checkbox
  `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` 과
  `ls test/perf/*read*.perf-spec.ts | wc -l` 을 실행해 각각 **36** · **32** 임을 확인하고, 문서에
  적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는 `97198504` (PR #1212).
- [ ] **AC 2 — PLAN `142 행` 갱신.** ① perf-spec 개수 `35` → `36`, read 경로 `31` → `32`, 범위
  표기 `T-0830~T-1500` → `T-0830~T-1502`, ② "실 DB round-trip **첫 실측 도달**" 서술을
  **slice 2 까지 도달** 로 확장해 `group-read-realdb.perf-spec.ts` (T-1502, main `97198504`) 가
  `GET /api/groups` · `:id/persons` 의 **N+1 indirect navigation** 경로 p95 를 실측했음을 1 문장
  추가, ③ 잔여 서술의 endpoint `1 개` → **2 개(route 4)**, mock 잔존 read perf-spec `30 개` →
  **30 개** 가 아닌 실측값으로 정정 (`32 - 2 = 30` 이 아니라 실제 mock 잔존 수를 AC 1 결과로 산출),
  ④ README 절 제목 인용을 `(slice 목록)` 으로 정정. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 3 — 부하계획 `§ 5` item 5 갱신.** "첫 실 DB round-trip 실측 도달(T-1500)" 서술에
  slice 2 (T-1502, main `97198504`) 를 **1 ~ 2 문장으로 병기** 하고 실측 범위를 `1 endpoint` →
  `2 endpoint (조회 4 route)` 로 정정, README 절 제목 인용을 `(slice 목록)` 으로 고친다.
  **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport` 관찰 전용 · baseline 미확정 ·
  임계 fix 미완 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 4 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 2 를 반영한다 — 실측 endpoint 수 · 대상 route · N+1 경로 측정이라는 질적 차이 ·
  README 절 제목 정정 · 잔여 mock spec 수 정정. **status 토큰 `IN_PROGRESS` 는 불변**,
  "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" 서술도 불변.
- [ ] **AC 5 — 잔여 1 건 신규 박제.** T-1502 reviewer 가 남긴 **"대규모 membership 에서의 N+1 규모
  민감도 미측정"** (측정 표본이 소규모 seed 라 membership 수 증가에 따른 latency 기울기는
  미확인) 을 세 문서 중 **최소 1 곳** (PLAN `142 행` 잔여 절 권장) 에 한 구절로 명시해, 후속 slice
  판단 근거를 남긴다.
- [ ] **AC 6 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 7 — 범위 표기 규약 준수.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지. **기존 행의 소급 치환은 금지**
  (본 task 는 정규화 task 가 아니다).
- [ ] **AC 8 — 검증 명령.** `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다. 코드 변경이
  0 이므로 test 는 불요하나, `docs/requirements.md` 편집이 표 행 구조 (파이프 구분) 를 깨지 않았는지
  `sed -n '67p' docs/requirements.md` 로 1 행 유지를 확인한다.

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1502 가 이미 정본을 갱신했다 — 본 task 는 인용만).
- **perf slice 3 착수** (나머지 read perf-spec 의 실 DB cutover · membership 규모 민감도 측정) —
  본 task 는 그 필요를 **문서에 적기만** 하고 실행하지 않는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** — 본 slice 와 무관.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 7).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 기록

- 완료 시각: 2026-08-05T16:44Z (fire `cron@aa-local-89e2d333-0630`)
- 결과: direct doc-sync 3 파일 (+11/-7) main `dbc37cdb` push. slice 2(T-1502) 실측을
  `docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 ·
  `docs/requirements.md` REQ-048 재판정 3 지점에 반영. perf-spec 36 / read 32 수치는 `ls` 실측값만 사용.
  "대규모 membership N+1 규모 민감도 미측정" 잔여를 박제하고 완료 선언은 0
  (PLAN `140 행` checkbox `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 item 5 미완 유지).
- AC 8 항목 전부 ok. 코드 변경 0 이라 R-110 tester 면제 대상 (링크 실재 · 표 구조는 직접 검증).
- 잔여 민감도 측정은 planner 가 T-1504 (pr-mode, slice 3) 로 큐잉.
