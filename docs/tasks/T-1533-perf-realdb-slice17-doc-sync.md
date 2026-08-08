---
id: T-1533
title: 실 DB round-trip slice 17(T-1532) export dump download 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: DONE
completedAt: 2026-08-08T18:48:00Z
commitSha: 4b091c46
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 60
estimatedFiles: 3
created: 2026-08-08
createdAt: 2026-08-08T17:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1532]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1532 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행을 endpoint 도메인 14 불변 · 조회 route 25 → 26 으로 갱신(slice 15 셈법, slice 16 문장 복사 금지) + 5-테이블 fan-out / stream artifact / 읽기량-응답크기 분리 3 축 박제"
---

# T-1533 — 실 DB round-trip slice 17 doc-sync (`ExportController` `GET /api/admin/export/:id/download`)

## Why

[T-1532](T-1532-perf-realdb-slice17-export-download-read.md) 가 PR #1227 로 머지돼 (main `2b632266`)
`test/perf/export-download-read-realdb.perf-spec.ts` 가 `ExportController` 의 다운로드 route
(`GET /api/admin/export/:id/download`) 를 실 Postgres 부트스트랩 · 실 JWT cookie 로 측정했다. 그런데
T-1532 의 `## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라
PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 16 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 16 까지 도달"** 과 **"실측 범위가 endpoint 14 개(조회 route 25) 뿐"**
은 slice 17 이 조회 route 를 하나 더 실측하면서 이미 **stale** 해졌다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1532 가 이미 slice 17 항목(`766 행` 부근)과
잔여 bullet 을 박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1525](T-1525-perf-realdb-slice13-doc-sync.md) · [T-1527](T-1527-perf-realdb-slice14-doc-sync.md) ·
[T-1529](T-1529-perf-realdb-slice15-doc-sync.md) · [T-1531](T-1531-perf-realdb-slice16-doc-sync.md) 가
slice 13~16 에 대해 수행한 doc-sync 의 **slice 17 판** 이다.

**계수 함정 — 직전 doc-sync(T-1531) 문장을 복사하면 틀린다.** slice 16 의 `CronScheduleController` 는
첫 `src/scheduling/` 진입이라 **도메인 13 → 14 · route 24 → 25 동시 증가** 였지만, slice 17 의
`ExportController` 는 slice 10(T-1518) · slice 15(T-1528) 에서 **이미 실측 도메인으로 잡혀 있다**.
따라서 slice 17 은 **endpoint 도메인 14 가 불변이고 조회 route 만 25 → 26** 으로 는다 — 이는
slice 15 와 같은 셈법이고 slice 16 과는 반대다.

아울러 T-1532 가 주장한 **구조 축 3 개** 를 박제한다 — ① **한 요청이 서로 무관한 5 테이블을 병렬로
읽는 첫 실측 경로** (`materializeFullExportDownload` → `collectFullExportRecords` 가
`EXPORT_ENTITY_SOURCES` 5 entity(Assessment · Person · Group · LlmConfig · AuditLog) 에 `Promise.all`
로 각각 `findMany` — 앞 16 slice 의 최대 fan-out 은 slice 2·3 의 membership indirect navigation 이라
같은 chain 안 loop 였다), ② **응답이 JSON body 가 아니라 stream artifact 인 첫 slice**
(`StreamableFile` 반환 + `serializeExportDownloadHeaders` 의 `Content-Type` / `Content-Disposition` /
`Content-Length` 세팅이라 latency 에 직렬화 + Buffer 수집 + header 산출 비용이 포함되고 **응답 크기가
byte 로 관측 가능한 첫 경로** 다), ③ **DB 읽기량과 응답 크기가 분리되는 첫 경로**
(scope 선별 `selectExportRecords` 가 DB 가 아니라 in-process 라 RANGE / PARTIAL job 은 응답이 작아져도
**읽는 row 수는 FULL 과 동일** — 규모 축이 "응답 크기" 가 아니라 "총 DB row 수" 이며 소규모 / 상대적
대규모 두 표본의 대소 관계와 byte 증가량은 slice 3 선례대로 단언하지 않는다).
`@Roles("Admin")` guard 레벨 403 · cookie 미부착/서명 변조 401 · 부재 id 404 는 slice 10~16 과
동일하므로 **새 축으로 적지 않는다**.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 17** bullet (`766 행` 부근) 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이
  파일을 **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1532-perf-realdb-slice17-export-download-read.md](T-1532-perf-realdb-slice17-export-download-read.md) —
  `## Why` 의 새 축 3 개 · 새 축 아님 판정(403 · 401 · 404 layer) · 계수 함정(도메인 14 불변) ·
  Out of Scope(production code 변경 0 · 임계값 불변 · 손상 scope 400 매핑 판단 유보) · Follow-ups.
- [test/perf/export-download-read-realdb.perf-spec.ts](../../test/perf/export-download-read-realdb.perf-spec.ts) 의
  상수 선언부와 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **50 개**(그중 read 경로
  **45 개** … T-0830~T-1530)" · "실 DB round-trip 실측이 **slice 16 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **14 개(조회 route 25)** 뿐" 이 slice 16 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 16 까지 도달**"(`135 행`), slice 16 서술
  (`341~355 행`), 실측 범위 서술(`356~360 행` 의 "14 endpoint (조회 25 route)"), 계산식
  "read 45 개 − 실 DB read 15 개"(`367 행`) 와 그 뒤 규모 민감도 잔여 목록(`369~381 행`).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~16 서술과 endpoint 개수 · "나머지 read perf-spec 30 개" 계산식이 있다.
  **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1531 선례 —
  `||` 표기를 "OR 분기" 로 우회했다).
- [T-1529](T-1529-perf-realdb-slice15-doc-sync.md) — **도메인 불변 + route 만 증가** 셈법의 직전
  선례(본 task 와 같은 셈법). [T-1531](T-1531-perf-realdb-slice16-doc-sync.md) — 직전 doc-sync 의
  구조·문체 선례이나 **계수 셈법은 반대** 이므로 문장 복사 금지. 두 선례 모두 **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **51** · **46** · **17** ·
  **16** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는
  `2b632266` (PR #1227) 이고, test 수는
  `grep -c "^\s*it(" test/perf/export-download-read-realdb.perf-spec.ts` 의 실측값 (**13**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 검산 (slice 4~16 과 동형).** slice 17 파일명에도 `read` 가 **있어**
  `*read*` glob 개수가 **45 → 46** 으로 증가하지만, 실 DB read 파일도 **15 → 16** 개
  (`group-persons-scale-realdb` 는 파일명에 `read` 가 없어 양쪽 모두에서 빠진다) 로 함께 늘어
  **"mock 잔존 read perf-spec 30 개" 는 여전히 불변** 이다 (46 − 16 = 30). 세 문서에서 이 30 을
  잘못 증감시키지 않고, 계산식 서술 (`read 45 개 − 실 DB read 15 개`) 은
  **`read 46 개 − 실 DB read 16 개`** 로 갱신하며 결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — 도메인 불변 + route 만 증가 셈법 반영 (slice 16 과 반대).** slice 17 의 측정 대상
  `ExportController` 는 slice 10 · slice 15 에서 **이미 실측된 도메인** 이므로 endpoint 도메인은
  **14 불변** 이고 조회 route 만 **25 → 26** 으로 는다. 직전 slice 16 의 "도메인과 route 를 각각
  1 개씩" 서술을 **복사하지 않고**, slice 17 이 **slice 15 와 같은 셈법(도메인 불변 · route 만
  1 증가)** 이며 같은 controller 를 세 번째로 재는 slice 라는 점을 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 4 — PLAN `142 행` 갱신.** ① perf-spec 개수 `50` → **51**, read 경로 `45` → **46**,
  glob 증가 서술을 **slice 17 기준(45 → 46)** 으로 정정, 범위 표기 `T-0830~T-1530` →
  **`T-0830~T-1532`** 로 정정, ② "실 DB round-trip 실측이 **slice 16 까지 도달**" → **slice 17 까지
  도달** 로 확장하고 `export-download-read-realdb.perf-spec.ts` (T-1532, main `2b632266`, 13 test)
  가 **이미 실측된 `ExportController` 의 다운로드 1 route (`GET /api/admin/export/:id/download`) 를
  실 JWT cookie 로 측정해 p95 < 3000ms 임을 실측** 했다는 1 ~ 2 문장 추가 (**서로 무관한 5 테이블을
  `Promise.all` 로 병렬로 읽는 첫 fan-out** + **응답이 JSON body 가 아니라 `StreamableFile` stream
  artifact 이고 `Content-Length` 가 실 body byte 와 일치함을 단언하는 첫 경로** + **scope 선별이
  in-process 라 DB 읽기량과 응답 크기가 분리되는 첫 경로(규모 축 = 총 DB row 수, 대소 미단언)**
  3 축 병기, 아울러 **403 · 401 · 404 는 slice 10~16 과 동일해 새 축 아님** 1 구절), ③ 잔여 서술의
  범위를 **endpoint 14 개(조회 route 25) → endpoint 14 개(조회 route 26)** 로 갱신하고 slice 17 이
  **도메인을 늘리지 않고 route 만 더했음** 을 기존 순서 나열(slice 15 와 같은 셈법)에 이어 적는다
  (AC 3), ④ task 링크 목록에 T-1532 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 5 — 부하계획 `§ 5` item 5 갱신.** "slice 16 까지 도달" 서술(`135 행`)에 slice 17 (T-1532,
  main `2b632266`, 13 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술(`356~360 행`)의
  **14 endpoint (조회 25 route)** 를 **14 endpoint (조회 26 route)** 로 갱신한다 (slice 17 은 도메인을
  늘리지 않고 route 만 1 개 더한다는 점을 기존 괄호 서술과 정합되게 반영). `**잔여**` 구절의 "나머지
  read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`367 행`)만 갱신한다.
  규모 민감도 잔여 목록(`369~381 행`)에는 **slice 17 의 export dump download 조회** 도 덧붙이되, 그
  대상은 규모 축이 **응답 크기가 아니라 총 DB row 수** 라 slice 17 이 **소규모 / 상대적 대규모 두
  표본으로 이미 관측** 했고(대소 관계와 byte 증가량은 미단언) 그럼에도 **REQ-047 실 scale 부하와는
  무관한 소규모 표본** 이라는 1 구절을 병기한다 — 미측정 목록에 통째로 넣지도, 규모 축이 해소된 것처럼
  적지도 않는다. **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport` 관찰 전용 ·
  baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 6 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 17 을 반영한다 — 파일명 · task · main SHA · test 수(13) · **질적 차이 3 축
  (5 테이블 병렬 fan-out / stream artifact 응답과 `Content-Length` 일치 단언 / DB 읽기량과 응답 크기
  분리)** · 조회 1 route · "endpoint 수 **14 개 불변 (조회 26 route)**". **status 토큰 `IN_PROGRESS`
  는 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix
  미완" 서술도 불변.
- [ ] **AC 7 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1531 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다.
- [ ] **AC 8 — REQ-047 오독 차단.** 세 문서 어디에도 slice 17 이 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. 표본은 상대 비교용
  소규모(entity 당 1~2 row 와 Person 20 + Assessment 20 누적 · 반복 소수 회)임을 오독 여지 없이
  서술하고, REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 9 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint (contribution fan-out · summary 시계열 · part 소속 조회 · user 목록 전량 SELECT ·
  permission-denied audit 목록 · export job polling · LLM provider config 조회 · import job polling ·
  difficulty mapping 고정 슬롯 조회 · auth me self 조회 · export status-view 파생 조회 · cron
  schedule 레지스트리 조회 · **export dump download 포함**) 의 규모 민감도 미측정, (c) baseline 파일
  확정 · 임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도
  삭제됐으면 되돌린다.
- [ ] **AC 10 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 11 — 범위 표기 규약 준수 + 검증 명령.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1532 가 이미 slice 17 항목과 잔여 bullet 을
  박제했다 — 인용만).
- **perf slice 18 착수** (남은 mock 잔존 read perf-spec 30 개의 실 DB cutover · `GET /api/admin/import/:id` ·
  `GET /api/groups/:id/members` 등 미측정 read route · write / trigger route 측정) — 본 task 는 그
  필요를 **문서에 적기만** 하고 실행하지 않는다.
- **`GET :id/download` 의 손상 scope 400 매핑 판단** — T-1532 Follow-ups 가 별도 pr task 로 이월한
  건이다. 본 doc-sync 는 현재 동작(filter 미부착 → 5xx) 을 **판단 없이 인용만** 하고 재판정하지 않는다.
- **production code 변경 · index 튜닝 · pagination 도입** — index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. 필요 판단이 서면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 8) · **REQ-030 / REQ-032 / REQ-045 행 재판정** — 본 slice 의
  측정 대상은 latency 일 뿐 export 기능·보안 요건 재판정이 아니다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 11).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
