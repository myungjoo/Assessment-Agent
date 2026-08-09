---
id: T-1538
title: 실 DB round-trip slice 19(T-1537) person 단건 상세 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 95
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T03:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1537]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1537 Follow-ups 가 이월한 direct doc-sync — PLAN 142 행 slice 18 → 19 · 도메인 14 불변 · 조회 route 27 → 28 + 부하계획 §5 item 5 인벤토리 (A) 26 → 27 / (B) 4 → 3 재분류 및 person-detail 보수 분류 해소"
---

# T-1538 — 실 DB round-trip slice 19 doc-sync (`PersonController` `GET /api/persons/:id`)

## Why

[T-1537](T-1537-perf-realdb-slice19-person-detail-read.md) 이 PR #1229 로 머지돼 (main `9466d76d`)
`test/perf/person-detail-read-realdb.perf-spec.ts` 가 `PersonController` 의 단건 상세 조회 route
(`GET /api/persons/:id`) 를 실 Postgres 부트스트랩으로 측정했다. 그런데 T-1537 의 `## Out of Scope` 가
[CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라 PLAN · 부하계획 · REQ-048
갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 18 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 18 까지 도달"** 과 **"실측 범위가 endpoint 14 개(조회 route 27) 뿐"**
은 slice 19 가 조회 route 를 하나 더 실측하면서 이미 **stale** 해졌다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1537 이 이미 slice 19 항목과 잔여 계수를
박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1531](T-1531-perf-realdb-slice16-doc-sync.md) · [T-1533](T-1533-perf-realdb-slice17-doc-sync.md) ·
[T-1535](T-1535-perf-realdb-slice18-doc-sync.md) 가 slice 16~18 에 대해 수행한 doc-sync 의
**slice 19 판** 이며, 여기에 **T-1536 인벤토리 재분류** 라는 앞 slice 에 없던 갱신 대상이 하나 더 붙는다.

**본 doc-sync 고유 대상 — T-1536 인벤토리의 (A)/(B) 재분류.** 직전
[T-1536](T-1536-perf-realdb-remaining-route-inventory.md) 이 부하계획 `§ 5` item 5 에 박제한 **잔여
read route 인벤토리** 는 `person-detail-read` → `GET /api/persons/:id` 를 **(B) 진짜 잔여 후보** 로
두되 "realdb spec 이 그 path 를 404 negative 로만 두드려 happy-path 근거를 못 찾았다" 는 이유로
**보수 분류** 라고 명시했다. slice 19 가 그 route 를 happy-path 로 실측했으므로 본 task 는 그 유보를
**해소** 한다 — (A) **26 → 27** (표에 slice 19 행 추가), (B) **4 → 3** (`person-detail-read` 제거),
자체 검산 `A + B = 27 + 3 = 30`, 보수 분류 단락은 **`import-detail-read` 1 건만 남기고** 축소한다.
(C) 는 **0 건 불변** 이되 그 검산식 `실측 27 + (B) 4 = 31` 은 **`실측 28 + (B) 3 = 31`** 로 바뀐다
(조회 route 총 31 은 불변).

**계수 함정 ① — mock 잔존 30 은 이번에도 불변.** slice 19 파일명에도 `read` 가 있어 `*read*` glob 이
**47 → 48** 로 늘지만 실 DB read 도 **17 → 18** 로 함께 늘어 `48 − 18 = 30` 으로 **여전히 30** 이다.
세 문서에서 이 30 을 잘못 증감시키지 않는다.

**계수 함정 ② — 도메인은 늘지 않는다.** slice 19 의 `PersonController` 는 slice 1(T-1500) 에서 **이미
실측된 도메인** 이므로 endpoint 도메인은 **14 불변** 이고 조회 route 만 **27 → 28** 로 는다 — slice
15·17·18 과 같은 셈법이다. slice 16 의 "도메인과 route 를 각각 1 개씩" 서술을 **복사하면 틀린다**.

**계수 함정 ③ — mock 짝이 존재한다 (slice 18 과 반대).** slice 18 은 mock 짝이 **없는** 첫 slice 여서
T-1535 가 "mock 짝 부재" 를 명시했는데, slice 19 는 [`person-detail-read.perf-spec.ts`](../../test/perf/person-detail-read.perf-spec.ts)
(T-0847) 라는 mock 짝이 **실존** 한다. T-1535 의 "mock 짝 부재" 문장을 그대로 복사하면 **거짓 서술** 이
된다 — 본 slice 는 (A) 부류로 옮겨가는 **첫 인벤토리 재분류 사례** 로 적는다.

아울러 T-1537 이 주장한 **구조 축 3 개** 를 박제한다 — ① **soft-delete 가시성 비대칭의 첫 실측**
(같은 테이블에서 목록 `findActive` 는 `active: true` 를 강제(REQ-026)해 비활성 row 를 감추는데 단건
`findById` 는 필터가 없어 **200 + `active: false`** 로 노출 — 한 테이블의 목록 route 와 단건 route 가
서로 다른 가시성 규칙을 갖는 첫 경로), ② **목록 ↔ 단건 페어 측정** (같은 seed 상태에서 두 route 를 한
spec 으로 재되 **대소 관계는 slice 3 선례대로 미단언** 인 관찰 기록), ③ **규모 축의 의미가 route 마다
갈린다는 관찰** (목록은 결과 집합이 규모에 비례하지만 단건은 응답이 1 row 고정 — 두 표본 모두 3000ms
미만만 단언하고 증가율 미단언). **새 축이 아닌 것** 도 병기한다 — PK 직행 `findUnique` 자체는 slice
11·14 와 동일, repository null → 404 분기는 slice 11 과 동일, **guard 미부착(401 / 403 구조적 부재) 은
slice 1·2·7 과 동일** 이라 새 축이 아니다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 19** bullet 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1537-perf-realdb-slice19-person-detail-read.md](T-1537-perf-realdb-slice19-person-detail-read.md) —
  `## Why` 의 구조 축 3 개 · `## Result` 의 실측 결과 · `## Follow-ups` 의 doc-sync 요구 명세
  (계수 · 재분류 대상 · 완료 선언 0 유지).
- [test/perf/person-detail-read-realdb.perf-spec.ts](../../test/perf/person-detail-read-realdb.perf-spec.ts) 의
  상수 선언부와 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **52 개**(그중 read 경로
  **47 개** … T-0830~T-1534)" · "실 DB round-trip 실측이 **slice 18 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **14 개(조회 route 27)** 뿐" 이 slice 18 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "실 DB round-trip 실측이 **slice 18 까지 도달**"(`135 행`), slice 18 서술(`378 행`
  부근), 셈법 서술(`406 행` 부근), 계산식 "read 47 개 − 실 DB read 17 개"(`414 행` 부근), 규모 민감도
  잔여 목록(`422 행` · `432 행` 부근), 그리고 **잔여 read route 인벤토리**(`439~507 행`) 의 (A) 표
  (`451~478 행`) · (B) 목록(`483~488 행`) · 보수 분류 단락(`490~493 행`) · (C) 절(`495~503 행`) ·
  자체 검산(`505~507 행`).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~18 서술과 endpoint 개수 · "나머지 read perf-spec 30 개" 계산식이 있다.
  **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1535 선례 —
  `||` 표기를 "OR 분기" 로 우회했다).
- [T-1535](T-1535-perf-realdb-slice18-doc-sync.md) — **도메인 불변 + route 만 증가** 셈법의 직전
  선례이자 본 task 의 구조·문체 mirror. **완료 선언 금지 · checkbox `[ ]` 유지 · `IN_PROGRESS` 유지**
  원칙을 그대로 승계한다. 단 그 task 의 **"mock 짝 부재"** 서술은 slice 19 에 **복사 금지** (계수
  함정 ③).

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **53** · **48** · **19** ·
  **18** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는
  `9466d76d` (PR #1229) 이고, test 수는
  `grep -c "^\s*it(" test/perf/person-detail-read-realdb.perf-spec.ts` 의 실측값 (**11**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 ① 검산.** slice 19 파일명에도 `read` 가 **있어** `*read*` glob 개수가
  **47 → 48** 로 증가하지만, 실 DB read 파일도 **17 → 18** 개로 함께 늘어 **"mock 잔존 read
  perf-spec 30 개" 는 여전히 불변** 이다 (48 − 18 = 30). 세 문서에서 이 30 을 잘못 증감시키지 않고,
  계산식 서술(`read 47 개 − 실 DB read 17 개`) 은 **`read 48 개 − 실 DB read 18 개`** 로 갱신하며
  결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — 계수 함정 ② (도메인 불변 + route 만 증가) 반영.** slice 19 의 측정 대상
  `PersonController` 는 slice 1 에서 **이미 실측된 도메인** 이므로 endpoint 도메인은 **14 불변** 이고
  조회 route 만 **27 → 28** 로 는다. slice 16 의 "도메인과 route 를 각각 1 개씩" 서술을 **복사하지
  않고**, slice 19 가 **slice 15·17·18 과 같은 셈법** 이며 `PersonController` 를 **두 번째로 재는
  slice** 라는 점을 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 4 — 계수 함정 ③ (mock 짝 존재) 반영.** 세 문서 어디에도 slice 19 에 대해 "mock 짝 부재"
  류 서술(T-1535 가 slice 18 에 쓴 문장)을 **복사하지 않는다** —
  `test/perf/person-detail-read.perf-spec.ts` 는 **실존** 한다(`ls test/perf/person-*read*.perf-spec.ts`
  로 확인). 필요한 곳에는 mock 짝이 있고 그 route 가 실 DB 로 측정되면서 **인벤토리 (B) → (A) 로
  옮겨가는 첫 사례** 라는 사실만 1 구절로 적고, mock spec 총수 변화가 **0** 임을 AC 2 의 계산식과
  모순 없이 서술한다.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `52` → **53**, read 경로 `47` → **48**, glob
  증가 서술을 **slice 19 기준(47 → 48)** 으로 정정, 범위 표기 `T-0830~T-1534` → **`T-0830~T-1537`**
  로 정정, ② "실 DB round-trip 실측이 **slice 18 까지 도달**" → **slice 19 까지 도달** 로 확장하고
  `person-detail-read-realdb.perf-spec.ts` (T-1537, main `9466d76d`, 11 test) 가 **`PersonController`
  의 단건 상세 1 route (`GET /api/persons/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측**
  했다는 1 ~ 2 문장 추가 (**soft-delete 가시성 비대칭 첫 실측 — 목록은 `active: true` 강제(REQ-026)로
  감추는 row 를 단건은 200 + `active:false` 로 노출** + **같은 seed 에서 목록 ↔ 단건을 나란히 재는
  페어(대소 미단언)** + **단건은 응답이 1 row 고정이라 규모 축의 의미가 route 마다 갈린다는 관찰(증가율
  미단언)** 3 축 병기, 아울러 **PK 직행 `findUnique` · null → 404 분기 · guard 미부착(401 / 403 구조적
  부재) 은 각각 slice 11·14 / slice 11 / slice 1·2·7 과 동일해 새 축 아님** 1 구절), ③ 잔여 서술의
  범위를 **endpoint 14 개(조회 route 27) → endpoint 14 개(조회 route 28)** 로 갱신하고 slice 19 가
  **도메인을 늘리지 않고 route 만 더했음** 을 기존 순서 나열에 이어 적는다 (AC 3), ④ task 링크
  목록에 T-1537 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 18 까지 도달" 서술(`135 행`)에 slice 19
  (T-1537, main `9466d76d`, 11 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술의 **14 endpoint
  (조회 27 route)** 를 **14 endpoint (조회 28 route)** 로 갱신한다 (`406 행` 부근 셈법 문장에 slice 19
  도 slice 15·17·18 과 같은 셈법임을 이어 적는다). `**잔여**` 구절의 "나머지 read perf-spec 30 개는
  service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`414 행` 부근)만 갱신한다. 규모 민감도 잔여
  목록(`422 행` 부근)에는 **slice 19 의 person 단건 상세 조회** 도 덧붙이되, 본 slice 가 **소규모 /
  상대적 대규모 두 표본을 관측 기록으로만 남겼고(대소 관계·증가율 미단언)** **단건은 응답이 1 row
  고정이라 규모 축의 의미 자체가 목록과 다르며** **REQ-047 실 scale 부하와는 무관한 소규모 표본**
  이라는 1 구절을 병기한다 — 미측정 목록에 통째로 넣지도, 규모 축이 해소된 것처럼 적지도 않는다.
  **"본 item 은 미완" 결론은 그대로 유지** — `buildBaselineReport` 관찰 전용 · baseline 미확정 ·
  임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 7 — 인벤토리 (A)/(B) 재분류 (본 task 고유).** 부하계획 `§ 5` item 5 의 **잔여 read route
  인벤토리**(`439~507 행`) 를 다음 5 지점 모두 갱신한다 — ① 머리말의 "slice 18 시점 확인분, T-1536"
  을 **"slice 19 시점 확인분, T-1536 → T-1538 갱신"** 취지로 정정하고 편집 전 실측 개수 4 종
  (`52`·`47`·`18`·`17`) 을 **`53`·`48`·`19`·`18`** 로 갱신, ② (A) 제목을 **26 개 → 27 개** 로 고치고
  표 끝에 `| person-detail-read | GET /api/persons/:id | slice 19 (person-detail-read-realdb) |`
  행 1 개 추가, ③ (B) 제목을 **4 개 → 3 개** 로 고치고 `person-detail-read` bullet **삭제**
  (`import-detail-read` · `part-detail-read` · `app-root-read` 3 개는 **문구 그대로 보존**),
  ④ **보수 분류 단락** 을 `import-detail-read` **1 건만** 남도록 고쳐 쓰되 `person-detail-read` 의
  유보가 **slice 19 실측으로 해소** 됐음을 1 구절로 남긴다(유보 이력을 삭제만 하고 끝내지 않는다),
  ⑤ **자체 검산** 을 **`A + B = 27 + 3 = 30`** ↔ **`read 48 − 실 DB read 18 = 30`** 으로 갱신한다.
  두 셈이 어긋나면 문서가 아니라 분류를 고친다.
- [ ] **AC 8 — 인벤토리 (C) 절 검산식 갱신 (0 건 불변).** (C) 절(`495~503 행`) 의 등식
  **`실측 27 + (B) 4 = 31`** 을 **`실측 28 + (B) 3 = 31`** 로 갱신한다 — 조회 route 총 **31 은
  불변** 이고 **(C) 는 여전히 0 건** 이다. slice 18 이 (C) 였다가 해소된 선례 서술과 `AppController`
  root 가 `app-root-read.perf-spec.ts` 실존으로 (B) 분류라는 서술은 **그대로 보존** 하고, "본 절은
  완전 열거를 주장하지 않는다 — 현 시점 확인분" 이라는 유보 문장도 삭제하지 않는다.
- [ ] **AC 9 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 19 를 반영한다 — 파일명 · task · main SHA · test 수(11) · **질적 차이 3 축
  (soft-delete 가시성 비대칭 / 목록 ↔ 단건 페어 측정 / 단건은 1 row 고정이라 규모 축 의미 상이)** ·
  조회 1 route · "endpoint 수 **14 개 불변 (조회 28 route)**". **status 토큰 `IN_PROGRESS` 는 불변**,
  "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도
  불변.
- [ ] **AC 10 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1535 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다. 부하계획
  (A) 표에 새로 넣는 행은 **정확히 3 셀**(mock spec / route / 실측 slice) 이어야 하며 편집 후
  기존 26 행 + 신규 1 행 = **27 행** 임을 확인한다.
- [ ] **AC 11 — REQ-026 오독 차단.** 세 문서 어디에도 slice 19 가 발견한 **가시성 비대칭** 을
  **결함 · REQ-026 위반 · 수정 필요** 로 읽히게 적지 않는다 — 본 doc-sync 는 현재 동작을 **판단 없이
  인용만** 하며 `findById` 에 active 필터를 추가할지는 별도 판단이다. REQ-026 행은 **수정하지
  않는다** (재판정 0).
- [ ] **AC 12 — REQ-047 오독 차단.** 세 문서 어디에도 slice 19 가 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. 표본은 상대 비교용
  소규모(5 건 / 100 건 수준 · 반복 소수 회)임을 오독 여지 없이 서술하고, REQ-047 행 (`66 행`) 은
  **수정하지 않는다**.
- [ ] **AC 13 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint 의 규모 민감도 미측정(목록에 **person 단건 상세 포함**), (c) baseline 파일 확정 ·
  임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도
  삭제됐으면 되돌린다.
- [ ] **AC 14 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` checkbox 가 `[ ]` 그대로,
  (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히 미완으로 읽히는지
  세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다. 인벤토리 (B) 가 4 → 3 으로
  줄었다고 해서 **잔여가 곧 소진 임박** 인 것처럼 읽히는 표현도 쓰지 않는다 ((A) 부류 mock spec 의
  retire 판단은 여전히 미착수이고 write / trigger route 는 애초에 목록 밖이다).
- [ ] **AC 15 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1537 이 이미 slice 19
  항목과 잔여 계수를 박제했다 — 인용만).
- **perf slice 20 착수** — 인벤토리 (B) 잔여 3 후보(`GET /api/admin/import/:id` ·
  `GET /api/parts/:id` · `GET /api`) 중 무엇을 다음 slice 로 할지 **결정하지도 측정하지도 않는다**.
  우선순위 부여는 planner 의 다음 호출 몫이다.
- **(A) 부류 mock perf-spec 의 retire · 삭제 · 통합** — 특히 이번에 (A) 로 옮겨가는
  [`person-detail-read.perf-spec.ts`](../../test/perf/person-detail-read.perf-spec.ts) 를 지울지
  남길지는 T-1536 이 명시적으로 유보한 별도 판단이다 (`test/` 변경이라 `pr`). Follow-ups 에만 적는다.
- **`PersonController` guard 부재 · `findById` 의 active 필터 부재에 대한 재판정** — 본 doc-sync 는
  현재 동작(401 / 403 분기 구조적 부재 · 비활성 row 단건 노출) 을 **판단 없이 인용만** 하고 REQ
  재판정을 하지 않는다 (AC 11). 필요 판단이 서면 Follow-ups 에만 적는다.
- **production code 변경 · index 튜닝 · pagination 도입** — index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. Follow-ups 에만 적는다.
- **PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지 (AC 13 · AC 14).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 12) · **REQ-026 행 수정** (AC 11) ·
  **REQ-028 / REQ-030 / REQ-045 행 재판정** — 본 slice 의 측정 대상은 latency 일 뿐 person 조회
  기능·보안 요건 재판정이 아니다.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 15).
- **ADR-0054 status flip · 새 dependency 도입 · `docs/architecture/*` 편집** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
