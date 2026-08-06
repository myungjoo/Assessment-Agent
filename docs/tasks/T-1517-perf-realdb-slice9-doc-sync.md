---
id: T-1517
title: 실 DB round-trip slice 9(T-1516) audience 차등 audit 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 3
created: 2026-08-06
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1516]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1516 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행 잔여 ①(endpoint 7 개) 을 8 개(조회 route 15) 로 갱신 + audience 차등·index 후보 2 개·다축 param 3 축 박제"
---

# T-1517 — 실 DB round-trip slice 9 doc-sync (audience 차등 audit 조회)

## Why

[T-1516](T-1516-perf-realdb-slice9-permission-denied-audience-read.md) 가 PR #1219 로 머지돼 (main
`87a1bcb8`) `test/perf/permission-denied-read-realdb.perf-spec.ts` 가
`PermissionDeniedRecordController` 의 조회 1 route (`GET /api/permission-denied-records`) 를
**audience 차등(거부가 아니라 결과 집합 축소)** 경로로 실 Postgres 위에서 측정했다. 그런데 T-1516 의
`## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라
PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 8 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행`
잔여 절의 **"실측 범위가 endpoint 7 개(조회 route 14) 뿐"** 은 slice 9 가 여덟 번째 endpoint
도메인을 실측하면서 이미 **stale** 해졌다. `test/perf/README.md` 는 T-1516 이 이미 slice 9
항목(`596 행`)과 잔여 bullet(`612 행`, endpoint 8 개 / 조회 route 15)을 박제했으므로 본 task 는 그
정본을 **인용만** 한다. 본 task 는 [T-1501](T-1501-perf-realdb-doc-sync.md) ·
[T-1503](T-1503-perf-realdb-slice2-doc-sync.md) · [T-1505](T-1505-perf-realdb-slice3-doc-sync.md) ·
[T-1507](T-1507-perf-realdb-slice4-doc-sync.md) · [T-1509](T-1509-perf-realdb-slice5-doc-sync.md) ·
[T-1511](T-1511-perf-realdb-slice6-doc-sync.md) · [T-1513](T-1513-perf-realdb-slice7-doc-sync.md) ·
[T-1515](T-1515-perf-realdb-slice8-doc-sync.md) 가 slice 1~8 에 대해 수행한 doc-sync 의
**slice 9 판** 이다.

slice 9 의 질적 차이는 개수 증가(endpoint 7 → 8)에 더해 **조회 구조 축 3 개** 다 — ① **거부 대신
결과 집합 축소(audience 차등)**: slice 8 이 403 **거부** 를 처음 실측했다면 slice 9 는 응답이 모두
200 인데 actor 에 따라 발화 query 수가 **1(Admin bypass) / 2(allowlist 조회 + `findMany`) /
1(공집합 early return)** 로 갈리는 첫 경로다 (slice 7 의 요청당 상수 2 query 와도 다르다).
② **index 후보 2 개 + 정렬 축 공유**: 대상 테이블은 `@@index([instanceRef, createdAt])` 와
`@@index([provider, httpStatus, createdAt])` **둘** 을 갖고 `@unique` 는 **0** 인 유일 실측 대상이라
optimizer 가 필터 조합에 따라 후보를 고르고 `orderBy: { createdAt: "desc" }` 가 두 index 의 후행
컬럼과 **정렬 축을 공유** 한다 (slice 4 = composite `@@index` 1 개, 5 = composite unique prefix,
6 = unique·index 중복 tuple, 7 = 무-index, 8 = 단일 컬럼 `@unique`). ③ **다축 query param 조합 +
allowlist `IN` 절**: 필터가 query 3 축(`instanceRef` · `provider` · `httpStatus`) 조합이고 non-Admin
경로는 접근 허용 instance 를 `instanceRef in [...]` 로 주입한다. 아울러 slice 9 는 **첫 `src/user/`
외부 module** 이자 **append-only audit 테이블** 측정이다. 본 doc-sync 는 이 셋을 3 문서에 박제하고
잔여 서술을 남은 축으로 좁힌다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 9** bullet (`596 행`) 과 그 뒤 **잔여** bullet (`612 행`) — 갱신의 **정본 근거**. 본 task 는
  이 파일을 **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1516-perf-realdb-slice9-permission-denied-audience-read.md](T-1516-perf-realdb-slice9-permission-denied-audience-read.md) —
  측정 범위(조회 1 route) · 새 축 3 개(audience 차등 결과 축소 · index 후보 2 개 + 정렬 축 공유 ·
  다축 query param + allowlist `IN`) · Out of Scope(production code 변경 0 · schema 불변 · mock 짝
  불변 · REQ-047 실 scale 부하 주장 금지).
- [test/perf/permission-denied-read-realdb.perf-spec.ts](../../test/perf/permission-denied-read-realdb.perf-spec.ts)
  `43 행` ~ `48 행` (`ITERATIONS = 8` · `SHORT_ITERATIONS = 4` · `SEED_ROWS`) 과 `it(` 목록 — 문서에
  적을 test 수 · seed 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **42 개**(그중 read 경로
  **37 개** … T-0830~T-1514)" · "실 DB round-trip 실측이 **slice 8 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **7 개(조회 route 14)** 뿐" 이 slice 8 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 8 까지 도달**"(`135 행`) 과 "실측 범위는
  **7 endpoint (조회 14 route)**"(`201 행`) 구절, 그리고 그 뒤 `**잔여**` 구절.
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~8 서술과 endpoint 개수 · "나머지 read perf-spec 30 개 (read 37 개 −
  실 DB read 7 개 …)" 계산식이 있다. **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이
  쪼개진다 (T-1515 결과 참조 — `||` 표기를 "OR 분기" 로 우회한 선례).
- [T-1515](T-1515-perf-realdb-slice8-doc-sync.md) — 직전 doc-sync 선례. **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts` 를 실행해 각각
  **43** · **38** · **9 파일**(그중 read-realdb **8**) 임을 확인하고, 문서에 적는 개수는 이 실측값만
  쓴다 (추정 금지). 본문에 쓰는 main SHA 는 `87a1bcb8` (PR #1219) 이고, test 수는
  `grep -c "^\s*it(" test/perf/permission-denied-read-realdb.perf-spec.ts` 의 실측값 (**12**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 검산 (slice 4~8 과 동형).** slice 9 파일명에도 `read` 가 **있어**
  `*read*` glob 개수가 **37 → 38** 로 증가하지만, 실 DB read 파일도 **7 → 8** 개
  (`group-persons-scale-realdb` 는 파일명에 `read` 가 없어 양쪽 모두에서 빠진다) 로 함께 늘어
  **"mock 잔존 read perf-spec 30 개" 는 여전히 불변** 이다 (38 − 8 = 30). 세 문서에서 이 30 을 잘못
  증감시키지 않고, 계산식 서술 (`read 37 개 − 실 DB read 7 개`) 은 **`read 38 개 − 실 DB read 8 개`**
  로 갱신하며 결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — PLAN `142 행` 갱신.** ① perf-spec 개수 `42` → **43**, read 경로 `37` → **38**, 범위
  표기 `T-0830~T-1514` → **`T-0830~T-1516`** 로 정정, ② "실 DB round-trip 실측이 **slice 8 까지
  도달**" → **slice 9 까지 도달** 로 확장하고 `permission-denied-read-realdb.perf-spec.ts`
  (T-1516, main `87a1bcb8`, 12 test) 가 **`PermissionDeniedRecordController` 조회 1 route
  (`GET /api/permission-denied-records`) 를 실 JWT 로 측정해 audience 차등(결과 집합 축소) 경로에서도
  p95 < 3000ms 임을 실측** 했다는 1 ~ 2 문장 추가 (**audience 차등 발화 query 1/2/1** +
  **`@unique` 0 · `@@index` 2 후보 + `createdAt desc` 정렬 축 공유** + **다축 query param 조합 +
  allowlist `IN` 절** 3 축 병기, 아울러 **첫 `src/user/` 외부 module · append-only audit 테이블**
  1 구절), ③ 잔여 서술의 endpoint 개수를 **7 개(조회 route 14) → 8 개(조회 route 15)** 로 갱신
  (slice 9 는 route 를 1 개만 더한다 — 2 개가 아니다), ④ task 링크 목록에 T-1516 추가.
  **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 4 — 부하계획 `§ 5` item 5 갱신.** "slice 8 까지 도달" 서술에 slice 9 (T-1516, main
  `87a1bcb8`, 12 test) 를 **1 ~ 2 문장으로 병기** 하고, "실측 범위는 **7 endpoint (조회 14 route)**"
  를 **8 endpoint (조회 15 route)** 로 갱신한다. `**잔여**` 구절의 "나머지 read perf-spec 30 개는
  service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식만 갱신한다. **"본 item 은 미완" 결론은
  그대로 유지** — `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을
  삭제하거나 완화하지 않는다.
- [ ] **AC 5 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 9 를 반영한다 — 파일명 · task · main SHA · test 수(12) · **질적 차이 3 축
  (audience 차등 결과 축소 / index 후보 2 개 + 정렬 축 공유 / 다축 query param + allowlist `IN`)** ·
  조회 1 route · "endpoint 수 7 개 → **8 개 (조회 15 route)**". 아울러 slice 8 이 **403 거부** 를
  실측했다면 slice 9 는 **거부 없이 같은 200 안에서 결과 집합이 actor 별로 축소** 되는 축이라는
  1 구절을 병기한다. **status 토큰 `IN_PROGRESS` 는 불변**, "시각화(web) 렌더 측정 축 부재" ·
  "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도 불변.
- [ ] **AC 6 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다.
- [ ] **AC 7 — REQ-047 오독 차단.** 세 문서 어디에도 slice 9 가 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. seed 는 상대
  비교용 소규모 표본(`ITERATIONS = 8` · `SHORT_ITERATIONS = 4` · `SEED_ROWS`) 임을 오독 여지 없이
  서술하고, REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 8 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint (contribution fan-out · summary 시계열 · part 소속 조회 · user 목록 전량 SELECT ·
  **permission-denied audit 목록 포함**) 의 규모 민감도 미측정, (c) baseline 파일 확정 · 임계 fix
  미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면
  되돌린다.
- [ ] **AC 9 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다.
- [ ] **AC 10 — 범위 표기 규약 준수 + 검증 명령.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  `test/perf/README.md` 도 **수정하지 않는다** (T-1516 이 이미 slice 9 항목과 잔여 bullet 을
  박제했다 — 인용만).
- **perf slice 10 착수** (남은 endpoint 의 실 DB cutover · audit 목록의 규모 민감도 · write route
  측정) — 본 task 는 그 필요를 **문서에 적기만** 하고 실행하지 않는다.
- **production code 변경 · index 튜닝 · audience 필터 리팩터링** — index 추가는 **schema 변경이라
  §5 BLOCKED 대상** 이다. 필요 판단이 서면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 7) · **REQ-008 / REQ-016 등 권한거부 audit REQ 행 수정** —
  본 slice 의 측정 대상이 아니다 (audience 차등은 latency 관측 대상일 뿐 audit 정책 재판정이 아니다).
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 10).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
