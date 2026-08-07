---
id: T-1525
title: 실 DB round-trip slice 13(T-1524) DifficultyMappingController 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P7
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 55
estimatedFiles: 3
created: 2026-08-07
independentStream: p7-perf-realdb-baseline
dependsOn: [T-1524]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1524 Out of Scope 가 머지 후로 이월한 direct doc-sync — PLAN 142 행 잔여 ①(endpoint 11 개) 을 12 개(조회 route 22) 로 갱신 + nullable 관계형 FK 미조인 / 부모-자식 Restrict 페어 / schema-bounded 고정 슬롯 3 축 박제"
---

# T-1525 — 실 DB round-trip slice 13 doc-sync (DifficultyMappingController 조회)

## Why

[T-1524](T-1524-perf-realdb-slice13-difficulty-mapping-read.md) 가 PR #1223 으로 머지돼 (main
`51c02093`) `test/perf/difficulty-mapping-read-realdb.perf-spec.ts` 가 `DifficultyMappingController`
의 조회 route (`GET /api/llm/difficulty-mappings`) 를 실 Postgres 위에서 측정했다. 그런데 T-1524 의
`## Out of Scope` 가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라 PLAN ·
부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 12 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실측 범위가 endpoint 11 개(조회 route 21) 뿐"** 은 slice 13 이 열두 번째 endpoint 도메인 + 조회
1 route 를 실측하면서 이미 **stale** 해졌다. `test/perf/README.md` 는 T-1524 가 이미 slice 13 항목
(`673 행`) 과 잔여 bullet 을 박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1501](T-1501-perf-realdb-doc-sync.md) · [T-1503](T-1503-perf-realdb-slice2-doc-sync.md) ·
[T-1505](T-1505-perf-realdb-slice3-doc-sync.md) · [T-1507](T-1507-perf-realdb-slice4-doc-sync.md) ·
[T-1509](T-1509-perf-realdb-slice5-doc-sync.md) · [T-1511](T-1511-perf-realdb-slice6-doc-sync.md) ·
[T-1513](T-1513-perf-realdb-slice7-doc-sync.md) · [T-1515](T-1515-perf-realdb-slice8-doc-sync.md) ·
[T-1517](T-1517-perf-realdb-slice9-doc-sync.md) · [T-1519](T-1519-perf-realdb-slice10-doc-sync.md) ·
[T-1521](T-1521-perf-realdb-slice11-doc-sync.md) · [T-1523](T-1523-perf-realdb-slice12-doc-sync.md)
가 slice 1~12 에 대해 수행한 doc-sync 의 **slice 13 판** 이다.

slice 13 의 질적 차이는 개수 증가(endpoint 11 → 12, 조회 route 21 → 22)에 더해 **구조 축 3 개** 다 —
① **nullable 관계형 FK 의 NULL / 비-NULL 혼재 + `include` 0 미조인 조회** (`llmProviderConfigId` 가
`String?` 이라 슬롯마다 지정 / 미지정이 갈리는데, 앞 12 slice 의 payload 축에는 **관계형 FK 자체가
nullable 인 경로가 없었다** — slice 10 의 `Json?` 2 컬럼은 구조화 scalar, slice 12 의 `Int?` /
`String?` 은 비-관계 scalar 다. 부모 row 가 실재해도 `findMany()` 가 `include` 를 주지 않아 **join 0 ·
FK 는 문자열 컬럼으로만 직렬화** 된다), ② **부모–자식 두 테이블이 각각 별도 slice 로 실측되는 첫 페어 +
`onDelete: Restrict` 로 정리 순서가 강제되는 첫 실 DB slice** (부모 `LlmProviderConfig` 는 slice 11
([T-1520](T-1520-perf-realdb-slice11-llm-provider-config-read.md), main `a3703964`) 에서 이미 쟀고 본
slice 는 그 **자식** 을 잰다. 두 테이블 모두 `truncateAll` 명단 밖이라 spec-local `deleteMany` 가
필요하고 **자식 먼저** 순서를 지켜야 한다), ③ **schema 로 카디널리티가 상한된 고정 슬롯 테이블**
(`@@unique([difficulty])` + easy/medium/hard 3 슬롯 고정 — [ADR-0011](../decisions/ADR-0011-difficulty-model-assignment.md)
§1 — 이라 결과 집합이 구조적으로 3 을 넘을 수 없어 **규모 민감도가 schema 로 bounded 인 첫 실측 경로**
다). `@Roles("Admin")` guard 레벨 403 은 slice 10·11·12 와 동일하므로 **새 축으로 적지 않고**, 무필터
전량 `findMany()` 도 slice 11 과 같아 새 축이 아니다. 본 doc-sync 는 이를 3 문서에 박제하고 잔여
서술을 남은 축으로 좁힌다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 13** bullet (`673 행`) 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1524-perf-realdb-slice13-difficulty-mapping-read.md](T-1524-perf-realdb-slice13-difficulty-mapping-read.md) —
  측정 범위(조회 1 route) · 새 축 3 개(nullable 관계형 FK 미조인 / 부모–자식 `Restrict` 페어 /
  schema-bounded 고정 슬롯) · 새 축 아님 판정(403 layer · 무필터 전량 조회) ·
  Out of Scope(production code 변경 0 · schema 불변 · 임계값 불변 · REQ-047 실 scale 부하 주장 금지).
- [test/perf/difficulty-mapping-read-realdb.perf-spec.ts](../../test/perf/difficulty-mapping-read-realdb.perf-spec.ts)
  의 상수 선언부와 `it(` 목록 — 문서에 적을 test 수 · seed 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **46 개**(그중 read 경로
  **41 개** … T-0830~T-1522)" · "실 DB round-trip 실측이 **slice 12 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **11 개(조회 route 21)** 뿐" 이 slice 12 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 12 까지 도달**"(`135 행`), 실측 범위 서술
  (`284 행`), 계산식 "read 41 개 − 실 DB read 11 개"(`292 행`) 와 그 뒤 규모 민감도 잔여 구절.
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~12 서술과 endpoint 개수 · "나머지 read perf-spec 30 개 (read 41 개 −
  실 DB read 11 개 …)" 계산식이 있다. **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이
  쪼개진다 (T-1515 · T-1517 · T-1519 · T-1521 · T-1523 선례 — `||` 표기를 "OR 분기" 로 우회했다).
- [T-1523](T-1523-perf-realdb-slice12-doc-sync.md) — 직전 doc-sync 선례. **완료 선언 금지 ·
  checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts` 를 실행해 각각
  **47** · **42** · **13 파일**(그중 read-realdb **12**) 임을 확인하고, 문서에 적는 개수는 이 실측값만
  쓴다 (추정 금지). 본문에 쓰는 main SHA 는 `51c02093` (PR #1223) 이고, test 수는
  `grep -c "^\s*it(" test/perf/difficulty-mapping-read-realdb.perf-spec.ts` 의 실측값 (**8**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 검산 (slice 4~12 와 동형).** slice 13 파일명에도 `read` 가 **있어** `*read*`
  glob 개수가 **41 → 42** 로 증가하지만, 실 DB read 파일도 **11 → 12** 개
  (`group-persons-scale-realdb` 는 파일명에 `read` 가 없어 양쪽 모두에서 빠진다) 로 함께 늘어
  **"mock 잔존 read perf-spec 30 개" 는 여전히 불변** 이다 (42 − 12 = 30). 세 문서에서 이 30 을 잘못
  증감시키지 않고, 계산식 서술 (`read 41 개 − 실 DB read 11 개`) 은 **`read 42 개 − 실 DB read 12 개`**
  로 갱신하며 결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — PLAN `142 행` 갱신.** ① perf-spec 개수 `46` → **47**, read 경로 `41` → **42**, 범위
  표기 `T-0830~T-1522` → **`T-0830~T-1524`** 로 정정, ② "실 DB round-trip 실측이 **slice 12 까지
  도달**" → **slice 13 까지 도달** 로 확장하고 `difficulty-mapping-read-realdb.perf-spec.ts` (T-1524,
  main `51c02093`, 8 test) 가 **`DifficultyMappingController` 조회 1 route
  (`GET /api/llm/difficulty-mappings`) 를 실 JWT 로 측정해 p95 < 3000ms 임을 실측** 했다는 1 ~ 2 문장
  추가 (**nullable 관계형 FK 의 NULL / 비-NULL 혼재 + `include` 0 미조인 조회** + **부모–자식 두
  테이블이 각각 별도 slice 로 실측되는 첫 페어이자 `onDelete: Restrict` 로 정리 순서가 강제되는 첫 실
  DB slice** + **`@@unique([difficulty])` 3 슬롯 고정으로 규모가 schema-bounded 인 첫 실측 경로** 3 축
  병기, 아울러 **403 layer 와 무필터 전량 조회는 slice 10~12 와 동일해 새 축 아님** 1 구절), ③ 잔여
  서술의 endpoint 개수를 **11 개(조회 route 21) → 12 개(조회 route 22)** 로 갱신, ④ task 링크 목록에
  T-1524 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 4 — 부하계획 `§ 5` item 5 갱신.** "slice 12 까지 도달" 서술(`135 행`)에 slice 13 (T-1524,
  main `51c02093`, 8 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술(`284 행`)의
  **11 endpoint (조회 21 route)** 를 **12 endpoint (조회 22 route)** 로 갱신한다. `**잔여**` 구절의
  "나머지 read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`292 행`)만
  갱신한다. 규모 민감도 잔여 목록에는 **slice 13 의 difficulty mapping 고정 슬롯 조회** 도 미측정
  대상으로 덧붙이되, 그 대상은 schema 로 3 row 상한이라 **규모 축의 의미가 다르다** 는 1 구절을
  병기한다. **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport` 관찰 전용 · baseline
  미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 5 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 13 을 반영한다 — 파일명 · task · main SHA · test 수(8) · **질적 차이 3 축
  (nullable 관계형 FK 미조인 / 부모–자식 `Restrict` 페어 / schema-bounded 고정 슬롯)** · 조회 1 route ·
  "endpoint 수 11 개 → **12 개 (조회 22 route)**". **status 토큰 `IN_PROGRESS` 는 불변**,
  "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도
  불변.
- [ ] **AC 6 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 · T-1517 · T-1519 ·
  T-1521 · T-1523 선례). 편집 후 `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수
  불변을 확인한다.
- [ ] **AC 7 — REQ-047 오독 차단.** 세 문서 어디에도 slice 13 이 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. seed 는 상대 비교용
  소규모 표본(3 슬롯 고정 · 반복 소수 회)임을 오독 여지 없이 서술하고, REQ-047 행 (`66 행`) 은
  **수정하지 않는다**.
- [ ] **AC 8 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint (contribution fan-out · summary 시계열 · part 소속 조회 · user 목록 전량 SELECT ·
  permission-denied audit 목록 · export job polling · LLM provider config 조회 · import job polling ·
  **difficulty mapping 고정 슬롯 조회 포함**) 의 규모 민감도 미측정, (c) baseline 파일 확정 · 임계
  fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면
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
  `test/perf/README.md` 도 **수정하지 않는다** (T-1524 가 이미 slice 13 항목과 잔여 bullet 을
  박제했다 — 인용만).
- **perf slice 14 착수** (남은 endpoint 의 실 DB cutover · write route 측정 ·
  `PATCH /api/llm/difficulty-mappings/:difficulty` 측정 · 고정 슬롯 외 테이블의 규모 민감도) — 본
  task 는 그 필요를 **문서에 적기만** 하고 실행하지 않는다.
- **production code 변경 · index 튜닝 · pagination 도입** — index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. 필요 판단이 서면 Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지.
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 7) · **난이도 모델 배정 기능 REQ 행 재판정** — 본 slice 의
  측정 대상이 아니다 (매핑 조회는 latency 관측 대상일 뿐 배정 정책 재판정이 아니다).
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 10).
- **ADR-0054 status flip · 새 dependency 도입** — §5 BLOCKED 게이트.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
