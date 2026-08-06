---
id: T-1523
title: 실 DB round-trip slice 12(T-1522) ImportController 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P7
status: DONE
completedAt: 2026-08-06T18:05:15Z
resultCommit: c9db935a
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 3
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1522]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1522 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행 잔여 ①(endpoint 10 개) 을 11 개(조회 route 21) 로 갱신 + 0-query 배선 floor / 성분 병렬 관측 / enum 2 종 혼재 3 축 박제"
---

# T-1523 — 실 DB round-trip slice 12 doc-sync (ImportController 조회)

## Why

[T-1522](T-1522-perf-realdb-slice12-import-modes-running-read.md) 가 PR #1222 로 머지돼 (main
`cc8b9f36`) `test/perf/import-read-realdb.perf-spec.ts` 가 `ImportController` 의 조회 2 route
(`GET /api/admin/import/modes` · `GET /api/admin/import/running`) 를 실 Postgres 위에서 측정했다.
그런데 T-1522 의 `## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed
금지) 에 따라 PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 11 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행`
잔여 절의 **"실측 범위가 endpoint 10 개(조회 route 19) 뿐"** 은 slice 12 가 열한 번째 endpoint
도메인 + 조회 2 route 를 실측하면서 이미 **stale** 해졌다. `test/perf/README.md` 는 T-1522 가 이미
slice 12 항목(`652 행`)과 잔여 bullet(`673 행`, endpoint 11 개 / 조회 route 21 / perf-spec 46 /
read glob 41)을 박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1501](T-1501-perf-realdb-doc-sync.md) · [T-1503](T-1503-perf-realdb-slice2-doc-sync.md) ·
[T-1505](T-1505-perf-realdb-slice3-doc-sync.md) · [T-1507](T-1507-perf-realdb-slice4-doc-sync.md) ·
[T-1509](T-1509-perf-realdb-slice5-doc-sync.md) · [T-1511](T-1511-perf-realdb-slice6-doc-sync.md) ·
[T-1513](T-1513-perf-realdb-slice7-doc-sync.md) · [T-1515](T-1515-perf-realdb-slice8-doc-sync.md) ·
[T-1517](T-1517-perf-realdb-slice9-doc-sync.md) · [T-1519](T-1519-perf-realdb-slice10-doc-sync.md) ·
[T-1521](T-1521-perf-realdb-slice11-doc-sync.md) 가 slice 1~11 에 대해 수행한 doc-sync 의
**slice 12 판** 이다.

slice 12 의 질적 차이는 개수 증가(endpoint 10 → 11, 조회 route 19 → 21)에 더해 **구조 축 3 개** 다 —
① **DB 미도달 0-query route 의 첫 실측**: `modes` 는 handler 가 `async` 도 아닌 **동기 반환** 이고
service 미경유 · Prisma delegate 호출 **0** 이라, 실 DB 부트스트랩 아래에서 **guard stack + 라우팅 +
직렬화만의 배선 latency floor** 를 처음 분리 관측한다 (앞 11 slice 의 측정 route 는 예외 없이 최소
1 query 를 발화했다). ② **같은 controller · 같은 fixture 안에서 0-query route 와 DB round-trip route
를 나란히 측정**: `running` 은 실 `ImportJob` 을 `status: "RUNNING"` 으로 거르는 실 query 경로라
동일 프로세스 · 동일 표본 조건에서 **DB 성분과 배선 성분의 상대 관측 기록** 이 처음 남는다 (두
표본의 대소 관계는 slice 3 선례대로 wall-clock 비결정성 때문에 **단언하지 않고 관찰만** 한다).
③ **한 요청에 Prisma enum 2 종(필터 축 + payload 축) 혼재**: `ImportJob` 은 slice 10 `ExportJob` 의
정합 쌍이라 `@@index([status, createdAt])` leading-edge · `JobStatus` enum 필터 · `Restrict` FK 는
같지만, payload 축이 다르다 — `mode`(`ImportMode`) 라는 **두 번째 enum 컬럼** + `restoredRowCount`
(`Int?`) + `error` / `artifactRef`(`String?`) 의 **nullable scalar 혼재** 다 (slice 10 은 `Json?`
2 컬럼 JSONB 역직렬화 축이었다). 부수 축으로 `modes` 응답이 **DB 상태와 완전 무관한 고정 2 원소**
(REPLACE=destructive / MERGE) 라 seed 유무에 latency 가 반응하지 않는다. 403 layer 는 두 route 모두
`@Roles("Admin")` 이라 slice 10·11 과 동일하므로 **새 축으로 적지 않는다**. 본 doc-sync 는 이를
3 문서에 박제하고 잔여 서술을 남은 축으로 좁힌다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 12** bullet (`652 행`) 과 그 뒤 **잔여** bullet (`673 행`) — 갱신의 **정본 근거**. 본 task 는
  이 파일을 **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1522-perf-realdb-slice12-import-modes-running-read.md](T-1522-perf-realdb-slice12-import-modes-running-read.md) —
  측정 범위(조회 2 route) · 새 축 3 개(0-query 동기 handler 의 배선-only latency floor / 같은 fixture
  안 0-query 와 DB round-trip 성분 병렬 관측 / Prisma enum 2 종 + nullable scalar 혼재) · 부수 축
  (`modes` 는 DB 상태 무관 고정 2 원소 · 403 layer 는 slice 10·11 과 동일해 새 축 아님) ·
  Out of Scope(production code 변경 0 · schema 불변 · 임계값 불변 · REQ-047 실 scale 부하 주장 금지).
- [test/perf/import-read-realdb.perf-spec.ts](../../test/perf/import-read-realdb.perf-spec.ts) 의
  상수 선언부와 `it(` 목록 — 문서에 적을 test 수 · seed 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **45 개**(그중 read 경로
  **40 개** … T-0830~T-1520)" · "실 DB round-trip 실측이 **slice 11 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **10 개(조회 route 19)** 뿐" 이 slice 11 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 11 까지 도달**"(`135 행`), 실측 범위 서술
  (`260 행`), 계산식 "read 40 개 − 실 DB read 10 개"(`269 행`) 와 그 뒤 규모 민감도 잔여 구절
  (`274 행`).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~11 서술과 endpoint 개수 · "나머지 read perf-spec 30 개 (read 40 개 −
  실 DB read 10 개 …)" 계산식이 있다. **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이
  쪼개진다 (T-1515 · T-1517 · T-1519 · T-1521 선례 — `||` 표기를 "OR 분기" 로 우회했다).
- [T-1521](T-1521-perf-realdb-slice11-doc-sync.md) — 직전 doc-sync 선례. **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts` 를 실행해 각각
  **46** · **41** · **12 파일**(그중 read-realdb **11**) 임을 확인하고, 문서에 적는 개수는 이 실측값만
  쓴다 (추정 금지). 본문에 쓰는 main SHA 는 `cc8b9f36` (PR #1222) 이고, test 수는
  `grep -c "^\s*it(" test/perf/import-read-realdb.perf-spec.ts` 의 실측값 (**8**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 검산 (slice 4~11 과 동형).** slice 12 파일명에도 `read` 가 **있어**
  `*read*` glob 개수가 **40 → 41** 로 증가하지만, 실 DB read 파일도 **10 → 11** 개
  (`group-persons-scale-realdb` 는 파일명에 `read` 가 없어 양쪽 모두에서 빠진다) 로 함께 늘어
  **"mock 잔존 read perf-spec 30 개" 는 여전히 불변** 이다 (41 − 11 = 30). 세 문서에서 이 30 을 잘못
  증감시키지 않고, 계산식 서술 (`read 40 개 − 실 DB read 10 개`) 은 **`read 41 개 − 실 DB read 11 개`**
  로 갱신하며 결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — PLAN `142 행` 갱신.** ① perf-spec 개수 `45` → **46**, read 경로 `40` → **41**, 범위
  표기 `T-0830~T-1520` → **`T-0830~T-1522`** 로 정정, ② "실 DB round-trip 실측이 **slice 11 까지
  도달**" → **slice 12 까지 도달** 로 확장하고 `import-read-realdb.perf-spec.ts` (T-1522, main
  `cc8b9f36`, 8 test) 가 **`ImportController` 조회 2 route (`GET /api/admin/import/modes` ·
  `GET /api/admin/import/running`) 를 실 JWT 로 측정해 DB 미도달 route 와 DB round-trip route 모두
  p95 < 3000ms 임을 실측** 했다는 1 ~ 2 문장 추가 (**0-query 동기 handler 의 배선-only latency floor
  첫 분리 관측** + **같은 controller · 같은 fixture 안 0-query 와 DB round-trip 성분 병렬 관측
  (대소 관계 미단언)** + **Prisma enum 2 종(필터 축 `JobStatus` + payload 축 `ImportMode`) +
  `Int?` / `String?` nullable scalar 혼재 (slice 10 의 `Json?` JSONB 축과 상이)** 3 축 병기, 아울러
  **`modes` 응답이 DB 상태 무관 고정 2 원소 · 403 layer 는 slice 10·11 과 동일해 새 축 아님** 부수 축
  1 구절), ③ 잔여 서술의 endpoint 개수를 **10 개(조회 route 19) → 11 개(조회 route 21)** 로 갱신,
  ④ task 링크 목록에 T-1522 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 4 — 부하계획 `§ 5` item 5 갱신.** "slice 11 까지 도달" 서술(`135 행`)에 slice 12 (T-1522,
  main `cc8b9f36`, 8 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술(`260 행`)의
  **10 endpoint (조회 19 route)** 를 **11 endpoint (조회 21 route)** 로 갱신한다. `**잔여**` 구절의
  "나머지 read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`269 행`)만
  갱신한다. 규모 민감도 잔여 목록(`274 행`)에는 **slice 12 의 import job polling / modes 조회** 도
  미측정 대상으로 덧붙인다. **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport` 관찰
  전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 5 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 12 를 반영한다 — 파일명 · task · main SHA · test 수(8) · **질적 차이 3 축
  (0-query 배선 latency floor / 같은 fixture 안 성분 병렬 관측 / enum 2 종 + nullable scalar 혼재)** ·
  조회 2 route · "endpoint 수 10 개 → **11 개 (조회 21 route)**". 아울러 slice 12 의 `modes` 는
  **Prisma delegate 호출 0 인 첫 측정 route** 라 앞 11 slice 의 "최소 1 query" 전제와 **다르다** 는
  1 구절을 병기한다. **status 토큰 `IN_PROGRESS` 는 불변**, "시각화(web) 렌더 측정 축 부재" ·
  "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도 불변.
- [ ] **AC 6 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 · T-1517 · T-1519 ·
  T-1521 선례). 편집 후 `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을
  확인한다.
- [ ] **AC 7 — REQ-047 오독 차단.** 세 문서 어디에도 slice 12 가 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. seed 는 상대
  비교용 소규모 표본(status 혼재 job 소수 row · 반복 소수 회)임을 오독 여지 없이 서술하고,
  REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 8 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint (contribution fan-out · summary 시계열 · part 소속 조회 · user 목록 전량 SELECT ·
  permission-denied audit 목록 · export job polling · LLM provider config 조회 · **import job
  polling 포함**) 의 규모 민감도 미측정, (c) baseline 파일 확정 · 임계 fix 미완, (d) 시각화(web)
  렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면 되돌린다.
- [ ] **AC 9 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 10 — 범위 표기 규약 준수 + 검증 명령.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1522 가 이미 slice 12 항목과 잔여 bullet 을
  박제했다 — 인용만).
- **perf slice 13 착수** (`DifficultyMappingController` 측정 · 남은 endpoint 의 실 DB cutover ·
  write route 측정 · import job 의 규모 민감도) — 본 task 는 그 필요를 **문서에 적기만** 하고
  실행하지 않는다.
- **production code 변경 · index 튜닝 · pagination 도입** — index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. 필요 판단이 서면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 7) · **import/restore 기능 REQ 행 재판정** — 본 slice 의
  측정 대상이 아니다 (job 조회는 latency 관측 대상일 뿐 restore 실동작 재판정이 아니다).
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 10).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 완료 요약 (2026-08-06T18:05:15Z, direct commit `c9db935a`)

`docs/PLAN.md` `142 행` · `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 ·
`docs/requirements.md` REQ-048 3 지점에 [T-1522](T-1522-perf-realdb-slice12-import-modes-running-read.md)
의 `ImportController` 조회 2 route 실측을 반영했다 (3 파일 +33/-9).

- **계수 갱신** — 실측 endpoint 10 → **11 개** (조회 route 19 → **21**), perf-spec **46** /
  read glob **41** / 실 DB perf-spec **12**(그중 read **11**). mock 잔존 read perf-spec **30 개**
  는 피감수(40→41) · 감수(10→11) 동반 증가로 **불변** — 세 문서 모두 계산식만 조정했다 (AC 2).
- **새 3 축 박제** — ① DB 미도달 0-query 동기 handler 의 배선-only latency floor ② 같은
  controller · 같은 fixture 안에서 0-query route 와 DB round-trip route 의 성분 병렬 관측
  (대소 관계 미단언) ③ 한 요청에 Prisma enum 2 종(`JobStatus` 필터 축 + `ImportMode` payload 축)
  + nullable scalar 혼재.
- **완료 선언 0 유지** — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 item 5 "미완"
  그대로. 잔여 4 축(mock 30 · 규모 민감도 미측정 · baseline/임계 fix 미완 · web 렌더 부재) 생존
  (AC 8 · AC 9).
- **정본 인용만** — `test/perf/README.md` 와 perf-spec 은 T-1522 가 이미 동기해 **수정 0**.
  REQ-047 행 · 표 구조 · 행 좌표 표기 규약 모두 무수정 (AC 6 · AC 7 · AC 10).

AC 1~10 전부 `ok`. Follow-ups 없음 — 다음 slice 13(`DifficultyMappingController`)은
[T-1524](T-1524-perf-realdb-slice13-difficulty-mapping-read.md) 로 큐잉됐다.
