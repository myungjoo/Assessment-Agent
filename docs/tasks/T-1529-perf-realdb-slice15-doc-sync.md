---
id: T-1529
title: 실 DB round-trip slice 15(T-1528) export status-view 파생 read 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: DONE
completedAt: 2026-08-08T10:50:00Z
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 3
created: 2026-08-08
independentStream: perf-realdb-slices
dependsOn: [T-1528]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1528 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행 잔여 서술을 조회 route 23 → 24 (endpoint 13 불변) 로 갱신 + 파생 view / enum 이 payload 결정 / 동일 row 두 route 페어 3 축 박제"
---

# T-1529 — 실 DB round-trip slice 15 doc-sync (`ExportController` `GET /api/admin/export/:id/status-view`)

## Why

[T-1528](T-1528-perf-realdb-slice15-export-status-view-read.md) 이 PR #1225 로 머지돼 (main `8d63f40c`)
`test/perf/export-status-view-read-realdb.perf-spec.ts` 가 `ExportController` 의 파생 view route
(`GET /api/admin/export/:id/status-view`) 를 실 Postgres 위에서 실 JWT cookie 로 측정했다. 그런데
T-1528 의 `## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라
PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 14 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 14 까지 도달"** 과 **"실측 범위가 endpoint 13 개(조회 route 23) 뿐"**
은 slice 15 가 조회 route 를 하나 더 실측하면서 이미 **stale** 해졌다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1528 이 이미 slice 15 항목과 잔여 bullet 을
박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는 [T-1521](T-1521-perf-realdb-slice11-doc-sync.md) ·
[T-1523](T-1523-perf-realdb-slice12-doc-sync.md) · [T-1525](T-1525-perf-realdb-slice13-doc-sync.md) ·
[T-1527](T-1527-perf-realdb-slice14-doc-sync.md) 가 slice 11~14 에 대해 수행한 doc-sync 의
**slice 15 판** 이다.

slice 15 의 질적 차이는 앞 14 slice 와 **셈법 자체가 다르다** — `ExportController` 는 slice 10 (T-1518)
에서 이미 실측된 아홉 번째 endpoint 도메인이라 **endpoint 도메인 수가 13 에서 늘지 않고 조회 route 만
23 → 24 로 늘어나는 첫 slice** 다 (slice 3 은 route 도 도메인도 늘리지 않고 규모 축만 더했으므로
"도메인 불변 + route 증가" 조합은 본 slice 가 처음이다). 이 셈법 차이를 3 문서에 정확히 반영하는 것이
본 doc-sync 의 핵심이다. 아울러 T-1528 이 주장한 **구조 축 3 개** 를 박제한다 — ① **파생 view 반환**
(DB row 와 응답 shape 가 완전히 다른 첫 실 DB 경로 — 앞 14 slice 는 raw record 이거나 필드 제거만 하는
sanitize 였는데 본 경로는 `phaseLabel` · `stepIndex` · `totalSteps` · `nextStatus` · `terminal` ·
`downloadable` · 한국어 `message` 를 **신설** 해 반환하므로 `ExportJob` 의 어떤 컬럼도 그대로 나오지
않는다), ② **DB enum 컬럼 1 개가 응답 전체를 결정** (`JobStatus` 4 값이 `JOB_STATUS_TO_VIEW` 매핑을
거쳐 `describeExportJobStatus` 로 4 종의 서로 다른 view 를 만든다 — slice 10 이 같은 enum 을
**필터 축** 으로 썼던 것과 달리 본 slice 는 같은 enum 을 **payload 결정 축** 으로 쓴다),
③ **같은 row 를 읽는 두 route 가 각각 별도 slice 로 실측되는 첫 페어** (slice 10 이 `GET :id` raw
record 를, 본 slice 가 `:id/status-view` 파생 view 를 잰다 — slice 13 의 부모–자식 페어는
**두 테이블** 이었지만 본 건은 **동일 테이블 · 동일 row** 다). `@Roles("Admin")` guard 레벨 403 과
`findUniqueOrThrow` 의 P2025 → 404 는 slice 10 과 동일하므로 **새 축으로 적지 않는다**.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 15** bullet 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1528-perf-realdb-slice15-export-status-view-read.md](T-1528-perf-realdb-slice15-export-status-view-read.md) —
  `## Why` 의 새 축 3 개 · 새 축 아님 판정 (403 layer · P2025 404) · Out of Scope (production code 변경
  0 · schema 불변 · 임계값 불변 · REQ-047 실 scale 부하 주장 금지) · `## Result (2026-08-08)` 의 실측
  수치와 머지 SHA.
- [test/perf/export-status-view-read-realdb.perf-spec.ts](../../test/perf/export-status-view-read-realdb.perf-spec.ts) 의
  상수 선언부와 `it(` 목록 — 문서에 적을 test 수 · seed 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **48 개**(그중 read 경로
  **43 개** … T-0830~T-1526)" · "실 DB round-trip 실측이 **slice 14 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **13 개(조회 route 23)** 뿐" 이 slice 14 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 14 까지 도달**"(`135 행`), 실측 범위 서술
  (`325 행` 의 "13 endpoint (조회 23 route)"), 계산식 "read 43 개 − 실 DB read 13 개"(`333 행`) 와
  그 뒤 규모 민감도 잔여 구절.
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~14 서술과 endpoint 개수 · "나머지 read perf-spec 30 개 (read 43 개 −
  실 DB read 13 개 …)" 계산식이 있다. **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이
  쪼개진다 (T-1515 ~ T-1527 선례 — `||` 표기를 "OR 분기" 로 우회했다).
- [T-1527](T-1527-perf-realdb-slice14-doc-sync.md) — 직전 doc-sync 선례. **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` 을 실행해
  각각 **49** · **44** · **15 파일**(그중 read-realdb **14**) 임을 확인하고, 문서에 적는 개수는 이
  실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는 `8d63f40c` (PR #1225) 이고, test 수는
  `grep -c "^\s*it(" test/perf/export-status-view-read-realdb.perf-spec.ts` 의 실측값 (**12**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 검산 (slice 4~14 와 동형).** slice 15 파일명에도 `read` 가 **있어** `*read*`
  glob 개수가 **43 → 44** 로 증가하지만, 실 DB read 파일도 **13 → 14** 개
  (`group-persons-scale-realdb` 는 파일명에 `read` 가 없어 양쪽 모두에서 빠진다) 로 함께 늘어
  **"mock 잔존 read perf-spec 30 개" 는 여전히 불변** 이다 (44 − 14 = 30). 세 문서에서 이 30 을 잘못
  증감시키지 않고, 계산식 서술 (`read 43 개 − 실 DB read 13 개`) 은 **`read 44 개 − 실 DB read 14 개`**
  로 갱신하며 결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — endpoint 도메인 불변 · route 만 증가 셈법 반영 (본 slice 고유).** slice 15 의 측정 대상
  `ExportController` 는 slice 10 (T-1518) 에서 이미 실측된 도메인이므로 **endpoint 도메인 수는 13 에서
  늘지 않고** 조회 route 만 **23 → 24** 로 늘어난다. 세 문서 어디에도 "열네 번째 endpoint 도메인"
  같은 서술을 쓰지 않고, **도메인 불변 + route 증가** 조합이 slice 15 가 처음이라는 점을 최소 1 곳에
  1 구절로 남긴다 (slice 3 은 route 도 도메인도 늘리지 않았음을 근거로 병기 가능).
- [ ] **AC 4 — PLAN `142 행` 갱신.** ① perf-spec 개수 `48` → **49**, read 경로 `43` → **44**, 범위
  표기 `T-0830~T-1526` → **`T-0830~T-1528`** 로 정정, ② "실 DB round-trip 실측이 **slice 14 까지
  도달**" → **slice 15 까지 도달** 로 확장하고 `export-status-view-read-realdb.perf-spec.ts` (T-1528,
  main `8d63f40c`, 12 test) 가 **`ExportController` 의 파생 view 1 route
  (`GET /api/admin/export/:id/status-view`) 를 실 JWT cookie 로 측정해 p95 < 3000ms 임을 실측** 했다는
  1 ~ 2 문장 추가 (**파생 view 반환 — DB row 와 응답 shape 가 완전히 다른 첫 경로** + **DB enum
  1 컬럼이 응답 전체를 결정 (slice 10 의 필터 축 대비 payload 결정 축)** + **같은 row 를 읽는 두 route
  가 각각 별도 slice 로 실측되는 첫 페어 (동일 테이블 · 동일 row)** 3 축 병기, 아울러 **`@Roles("Admin")`
  guard 레벨 403 과 `findUniqueOrThrow` P2025 → 404 는 slice 10 과 동일해 새 축 아님** 1 구절과
  **파생 view 불변식 2 종 (`downloadable === true ⟹ status === "ready"` · `nextStatus === null ⟺
  terminal === true`) 을 4 응답 전부에서 단언** 1 구절), ③ 잔여 서술의 범위를
  **endpoint 13 개(조회 route 23) → endpoint 13 개(조회 route 24)** 로 갱신 (AC 3), ④ task 링크
  목록에 T-1528 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 5 — 부하계획 `§ 5` item 5 갱신.** "slice 14 까지 도달" 서술(`135 행`)에 slice 15 (T-1528,
  main `8d63f40c`, 12 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술(`325 행`)의
  **13 endpoint (조회 23 route)** 를 **13 endpoint (조회 24 route)** 로 갱신한다 (slice 15 는 도메인을
  늘리지 않고 route 만 1 개 더한다는 점을 기존 괄호 서술과 정합되게 반영). `**잔여**` 구절의 "나머지
  read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`333 행`)만 갱신한다.
  규모 민감도 잔여 목록에는 **slice 15 의 export status-view 파생 조회** 도 미측정 대상으로 덧붙이되,
  그 대상은 결과 집합이 **단건 1 row 고정** 이라 규모 축이 row 수가 아니라 **status 값의 종류(4 값)**
  로만 갈린다는 1 구절을 병기한다. **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport`
  관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 6 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 15 를 반영한다 — 파일명 · task · main SHA · test 수(12) · **질적 차이 3 축
  (파생 view 반환 / enum 이 payload 결정 / 동일 row 두 route 페어)** · 파생 view 1 route ·
  "endpoint 수 **13 개 불변 (조회 24 route)**". **status 토큰 `IN_PROGRESS` 는 불변**,
  "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도
  불변.
- [ ] **AC 7 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1527 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다.
- [ ] **AC 8 — REQ-047 오독 차단.** 세 문서 어디에도 slice 15 가 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. seed 는 상대 비교용
  소규모 표본(4 status 혼재 job 소수 row · 반복 소수 회)임을 오독 여지 없이 서술하고, REQ-047 행
  (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 9 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint (contribution fan-out · summary 시계열 · part 소속 조회 · user 목록 전량 SELECT ·
  permission-denied audit 목록 · export job polling · LLM provider config 조회 · import job polling ·
  difficulty mapping 고정 슬롯 조회 · auth me self 조회 · **export status-view 파생 조회 포함**) 의
  규모 민감도 미측정, (c) baseline 파일 확정 · 임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 +
  REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면 되돌린다.
- [ ] **AC 10 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 11 — 범위 표기 규약 준수 + 검증 명령.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1528 이 이미 slice 15 항목과 잔여 bullet 을
  박제했다 — 인용만).
- **perf slice 16 착수** (남은 endpoint 의 실 DB cutover · write route 측정 ·
  `POST /api/auth/login` 등 세션 route 측정 · `GET :id/download` streaming route 측정) — 본 task 는
  그 필요를 **문서에 적기만** 하고 실행하지 않는다.
- **production code 변경 · index 튜닝 · pagination 도입** — index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. 필요 판단이 서면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 8) · **REQ-030 (export/import) 행 재판정** — 본 slice 의
  측정 대상이 아니다 (`:id/status-view` 는 latency 관측 대상일 뿐 export 기능 재판정이 아니다).
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 11).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (2026-08-08T10:50:00Z)

main `654e2299` 로 direct push 완료 (3 파일 `+28/-9`). perf-spec **49** / read glob **44** /
실 DB **15**(그중 read **14**) 로 갱신하고, mock 잔존 read perf-spec **30** 은 계산식만
`44 − 14` 로 조정해 불변을 유지했다. slice 15 의 특이점 — `ExportController` 가 slice 10 에서
이미 도메인으로 잡혀 있어 **조회 route 만 23 → 24 로 늘고 실측 endpoint 도메인 13 은 불변** —
을 3 문서에 그대로 박제했다. 구조 축 3 종(파생 view 반환 · `JobStatus` enum 이 payload 결정 ·
같은 row 를 raw/파생 두 route 로 측정하는 페어)을 기록하되 403·404 는 slice 10 과 동일해
새 축이 아님을 병기했다. AC 1~11 전부 ok, 완료 선언 0 (PLAN `142 행` `[ ]` ·
REQ-048 `IN_PROGRESS` · 부하계획 item 5 미완 유지).
