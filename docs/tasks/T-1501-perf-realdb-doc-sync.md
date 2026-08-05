---
id: T-1501
title: 실 DB round-trip 첫 실측을 PLAN P7 · load-resilience `§ 5` item 5 · REQ-048 재판정 3 문서에 반영 (doc-sync)
phase: P7
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 45
estimatedFiles: 3
created: 2026-08-05
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1500]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1500(PR #1211) 머지 직후 문서 정합 — 3 문서가 아직 '실 DB round-trip 미실측' 으로 서술 (§3.1 rule 3 상 direct 분리)"
---

# T-1501 — 실 DB round-trip 첫 실측의 문서 정합 (PLAN · 부하계획 · REQ-048)

## Why

직전 T-1500 (PR #1211, main `0395c51e`) 이 `test/perf/person-read-realdb.perf-spec.ts` 를 머지해
**mock override 0 · 실 Prisma round-trip 을 포함한 `GET /api/persons` 의 p95 < 3000ms** 를 최초로
실측했다. 그러나 그 사실을 근거로 삼는 3 문서는 아직 **"실 DB round-trip baseline 은 미실측"** 이라고
서술 중이라 merged reality 와 어긋난다 — [PLAN.md](../PLAN.md) `142 행` P7 성능검증 REQ-048
sub-bullet, [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5,
[requirements.md](../requirements.md) `67 행` REQ-048 재판정의 한계 문장이 그것이다.

T-1500 의 Out of Scope 가 이 3 문서 갱신을 "실측이 머지된 뒤 별도 `direct` task" 로 명시 이월했다
([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 — code 와 doc 의 mixed task 금지). 본 task 가 그 이월분이며,
방금 머지된 코드의 문서 정합을 맞추는 최우선 후속이다.

**승격 판단은 하지 않는다** — PLAN `140 행` checkbox 는 REQ-047 (배치 부하) 축 미착수 + web 렌더
측정 축 부재 + 나머지 30 개 read perf-spec 의 mock 잔존 때문에 `[ ]` 유지가 옳다. 본 slice 는 잔여
사유를 **정확히 좁혀 재서술** 하는 것이지 완료 선언이 아니다.

## Required Reading

- [docs/PLAN.md](../PLAN.md) `140 행` ~ `142 행` — P7 **성능 검증** bullet 과 그 하위 2 sub-bullet
  (REQ-047 / REQ-048). 특히 `142 행` 의 "`*.perf-spec.ts` **34 개**" 수치와 "**잔여**: service 계층
  mock + guard override 라 controller↔collector 배선만 측정하고 실 DB round-trip baseline 은
  미실측" 문장이 본 task 의 1 차 정정 대상.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `122 행` ~ `135 행`
  (`## 5. Follow-up 인덱스`) — 특히 item 5 "**baseline 확정 + 임계 fix**". 아울러 `54 행` ~ `61 행`
  (`### S2. 조회 API 응답 지연 (REQ-048)`) 은 목표·임계 서술이라 **불변 확인용** 으로만 읽는다.
- [docs/requirements.md](../requirements.md) `67 행` — REQ-048 행 (단일 표 row, 매우 긴 셀).
  말미 "한계 —" 이후의 "그마저 mock service 기반이라 … 실 DB · 실 scale … 부하 하의 3 초 충족은
  미검증" 문장이 2 차 정정 대상. 같은 표의 `66 행` REQ-047 행은 **불변**.
- [test/perf/README.md](../../test/perf/README.md) `508 행` ~ `531 행` (`## 실 DB round-trip baseline
  (첫 slice)`) — T-1500 이 머지한 실측 서술. 3 문서에 인용할 사실 (mock 짝과의 책임 경계 · 로컬 실행
  전제 · 임계 3000ms 불변 · baseline 미확정) 의 정본.
- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts) —
  실측 spec 본체 (헤더 주석 + 8 test 구성). 인용 시 파일 경로·test 수를 여기서 확인.
- [docs/tasks/T-1500-perf-realdb-person-read-baseline.md](T-1500-perf-realdb-person-read-baseline.md)
  — 특히 `## Out of Scope` 의 "`docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` ·
  `docs/requirements.md` 갱신 … 별도 `direct` task" 이월 문구 (본 task 의 근거).
- [docs/use-cases/REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) `§ 12.76` R1 · R4 +
  `§ 12.91` (R5 개정) — 범위 표기 규약. `docs/requirements.md` 는 5 문서군 **안** 이므로 본 task 가
  새로 적는 행 좌표는 규약을 따라야 한다 (`~` 구분자 · 단일 행은 `NNN 행` · `L` prefix 금지).

## Acceptance Criteria

- [ ] **AC 1 — PLAN REQ-048 sub-bullet 갱신.** [docs/PLAN.md](../PLAN.md) `142 행` 을 다음 3 점이
  모두 담기도록 고친다. ① perf-spec 개수를 실측값으로 갱신 (`ls test/perf/*.perf-spec.ts | wc -l`
  결과 = **35**, 그중 `*read*.perf-spec.ts` = **31**). ② 실 DB round-trip **첫 실측 도달** —
  `test/perf/person-read-realdb.perf-spec.ts` (T-1500) 가 mock override 0 부트스트랩 + 실 Prisma
  seed 로 `GET /api/persons` 의 p95 < 3000ms 를 실측했음을 링크와 함께 박제. ③ **잔여 사유 재서술**
  — "실 DB round-trip 미실측" 이 아니라 "endpoint **1 개** 범위 실측 · 나머지 read perf-spec 은
  mock 잔존 · baseline 확정/임계 fix 미완 (`§ 5` item 5) · 실 scale (REQ-047 규모) 미검증" 로 좁힌다.
  checkbox `[ ]` 는 **유지** 하고 그 유지 근거도 함께 명시.
- [ ] **AC 2 — 부하 계획 `§ 5` item 5 갱신.** [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md)
  item 5 (`134 행` ~ `135 행`) 에 "**첫 실 DB round-trip 실측 도달** (T-1500, `GET /api/persons`
  1 endpoint · 관찰 전용)" 사실과 "**잔여**: baseline 파일 확정 · 임계 fix · 나머지 endpoint 확대"
  를 함께 적는다. item 5 를 **완료로 선언하지 않는다** (`buildBaselineReport` 는 관찰 전용이고
  `writeBaselineFile` / `confirmOrCompareBaseline` 는 미사용이라 baseline 확정이 성립하지 않음).
- [ ] **AC 3 — REQ-048 재판정 한계 문장 정정.** [requirements.md](../requirements.md) `67 행` 의
  한계 서술에서 "실 DB … 부하 하의 3 초 충족은 미검증" 을 **부분 해소** 로 정정한다 — ① 실 DB
  round-trip 경로의 p95 pass 가 endpoint 1 개 (`GET /api/persons`) 에서 실측됐고 근거 파일이
  `test/perf/person-read-realdb.perf-spec.ts` 임을, ② 나머지 read perf-spec 은 여전히 mock 이고
  **실 scale (REQ-047 의 100~200명 / 50~100 repo) 부하는 미검증** 임을, ③ **시각화(web) 렌더 측정
  축 부재는 불변** 임을 각각 남긴다. 상태 토큰은 **`IN_PROGRESS` 유지** (완료 승격 금지).
- [ ] **AC 4 — 인용 사실 실측 검증.** 본 task 가 새로 적는 수치·경로·좌표는 전부 저장소 실측으로
  확인한다 — 최소 `ls test/perf/*.perf-spec.ts | wc -l`, `ls test/perf/*read*.perf-spec.ts | wc -l`,
  `git log --oneline -1 -- test/perf/person-read-realdb.perf-spec.ts` (T-1500 / `0395c51e` 확인),
  `grep -n "실 DB round-trip baseline" test/perf/README.md`. 확인한 명령과 결과를 commit trail 의
  `notes` 에 ≤ 2 줄로 요약.
- [ ] **AC 5 — 범위 표기 규약 준수.** `docs/requirements.md` 에 새로 적는 행 범위 표기는
  [`§ 12.76`](../use-cases/REQ-COVERAGE-AUDIT.md) R1 (`~` 구분자) · R4 (단일 행은 `NNN 행`) ·
  R5 (`§ 12.91` 개정 — `L` prefix 금지) 를 따른다. `docs/PLAN.md` · `docs/ops/*` 는 규약 적용 범위
  **밖** 이라 기존 표기를 소급 정정하지 않되, 본 task 가 **새로 적는** 좌표는 동형으로 쓴다.
- [ ] **AC 6 — 비대상 불변 확인.** `git diff` 상 다음이 **변경 0** 임을 확인한다 — PLAN `140 행`
  checkbox 와 `141 행` REQ-047 sub-bullet, requirements `66 행` REQ-047 행, 부하 계획 `§ 2` S2 목표
  문장 (`54 행` ~ `61 행`) 과 `§ 3` 임계 표, `test/perf/**` 전부.
- [ ] **AC 7 — 검증 명령.** `git diff --name-only` 결과가 정확히 위 3 개 `docs/` 파일뿐이고
  (`src/` · `test/` · `.github/` 변경 0 → `direct` mode 유지), `git diff --stat` 이 cap (≤ 300 LOC /
  ≤ 5 파일) 안임을 확인한다. 새로 추가한 markdown 상대 링크가 실제 파일을 가리키는지 각 경로를
  `ls` 로 확인 (깨진 링크 0).

## Out of Scope

- **코드 · test 변경 일체** (`src/` · `test/` · `.github/workflows/`) — 하나라도 건드리면 `direct`
  판정이 무너진다 ([CLAUDE.md](../../CLAUDE.md) §3.1 rule 3). 필요가 보이면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 승격** (`[ ]` → `[x]`) — REQ-047 배치 부하 축 미착수 + web 렌더 측정 축
  부재라 승격 조건 불충족.
- **`§ 5` item 5 완료 선언 · 임계값 (3000ms) 변경 · baseline 파일 확정** — 전부 별도 결정.
- **나머지 30 개 read perf-spec 의 실 DB cutover** — 후속 코드 slice (pr-mode).
- **REQ-047 재판정 갱신 · [ADR-0054](../decisions/ADR-0054-load-resilience-harness-tool.md) status
  flip · 부하 발생기 (k6 / artillery / autocannon) 도입** — 새 dependency 는 §5 BLOCKED 게이트.
- **[REQ-COVERAGE-AUDIT.md](../use-cases/REQ-COVERAGE-AUDIT.md) 에 `§ 12.NN` 감사 절 신설** — 본
  task 는 3 문서 정합만. 감사 절 필요 여부는 별도 판단.
- **web 렌더 latency 측정 축** (REQ-048 의 시각화 절반) — P6 backlog.
- **기존 문서의 무관한 표기 · typo 소급 정정** — 본 task 가 손대는 문장 범위 밖은 불변.

## Suggested Sub-agents

`implementer` 단독 (doc-only · 3 파일 in-place 정정). 코드 변경 0 이므로 `tester` 불요
([CLAUDE.md](../../CLAUDE.md) §3.2 direct doc-only 면제).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## Result (2026-08-05)

`Status: DONE` — main `74560c8c` (direct push, PR 없음). 3 문서 +11/-3:

- [PLAN.md](../PLAN.md) `142 행` P7 성능검증 REQ-048 sub-bullet — 실 DB round-trip 첫 실측 반영,
  잔여 사유 (endpoint 1 개 · read perf-spec 30 개 mock 잔존) 재서술, checkbox `[ ]` 유지.
- [load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 — 실측 도달 +
  미완 사유 + 잔여 명시 (완료 선언 없음).
- [requirements.md](../requirements.md) REQ-048 재판정 — 한계 문장을 "부분 해소" 로 정정,
  status `IN_PROGRESS` 유지 (실 scale 미검증 · web 렌더 축 불변).

AC 1~7 전부 ok. 인용 수치는 실측 확인 (`test/perf/*.perf-spec.ts` 35 개 · read 계열 31 개 ·
`person-read-realdb.perf-spec.ts` 최초 commit `0395c51e`). 후속: 나머지 mock read perf-spec 의
실 DB cutover 는 T-1502 (pr-mode, `GET /api/groups` 축) 로 이월.
