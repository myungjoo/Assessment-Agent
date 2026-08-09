---
id: T-1540
title: 실 DB round-trip slice 20(T-1539) part 단건 상세 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T07:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1539]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1539 Follow-ups 가 이월한 direct doc-sync — PLAN 142 행 slice 19 → 20 · 도메인 14 불변 · 조회 route 28 → 29 + 부하계획 §5 item 5 인벤토리 (A) 27 → 28 / (B) 3 → 2 재분류"
---

# T-1540 — 실 DB round-trip slice 20 doc-sync (`PartController` `GET /api/parts/:id`)

## Why

[T-1539](T-1539-perf-realdb-slice20-part-detail-read.md) 가 PR #1230 으로 머지돼 (main `915f7859`)
`test/perf/part-detail-read-realdb.perf-spec.ts` 가 `PartController` 의 단건 상세 조회 route
(`GET /api/parts/:id`) 를 실 Postgres 부트스트랩으로 측정했다. 그런데 T-1539 의 `## Follow-ups` 가
[CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라 PLAN · 부하계획 · REQ-048
갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 19 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 19 까지 도달"** 과 **"실측 범위가 endpoint 14 개(조회 route 28) 뿐"**
은 slice 20 이 조회 route 를 하나 더 실측하면서 이미 **stale** 해졌다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1539 가 이미 slice 20 항목과 잔여 계수를
박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1533](T-1533-perf-realdb-slice17-doc-sync.md) · [T-1535](T-1535-perf-realdb-slice18-doc-sync.md) ·
[T-1538](T-1538-perf-realdb-slice19-doc-sync.md) 가 slice 17~19 에 대해 수행한 doc-sync 의
**slice 20 판** 이며, 인벤토리 재분류 대상이 하나 더 붙는 구조도 T-1538 과 같다.

**본 doc-sync 고유 대상 — T-1536 인벤토리의 (A)/(B) 재분류 두 번째.** 부하계획 `§ 5` item 5 의
**잔여 read route 인벤토리** 는 `part-detail-read` → `GET /api/parts/:id` 를 **(B) 진짜 잔여 후보**
로 두고 있다. slice 20 이 그 route 를 happy-path 로 실측했으므로 (A) **27 → 28** (표에 slice 20 행
추가), (B) **3 → 2** (`part-detail-read` 제거) 로 옮기고 자체 검산 `A + B = 28 + 2 = 30` 을 맞춘다.
(C) 는 **0 건 불변** 이되 그 검산식 `실측 28 + (B) 3 = 31` 은 **`실측 29 + (B) 2 = 31`** 로 바뀐다
(조회 route 총 31 은 불변).

**계수 함정 ① — mock 잔존 30 은 이번에도 불변.** slice 20 파일명에도 `read` 가 있어 `*read*` glob 이
**48 → 49** 로 늘지만 실 DB read 도 **18 → 19** 로 함께 늘어 `49 − 19 = 30` 으로 **여전히 30** 이다.
세 문서에서 이 30 을 잘못 증감시키지 않는다.

**계수 함정 ② — 도메인은 늘지 않는다.** slice 20 의 `PartController` 는 slice 7(T-1512) 에서 **이미
실측된 도메인** 이므로 endpoint 도메인은 **14 불변** 이고 조회 route 만 **28 → 29** 로 는다 — slice
15·17·18·19 와 같은 셈법이고 slice 16 과는 반대다.

**계수 함정 ③ — 보수 분류 단락은 이번엔 손대지 않는다 (T-1538 과 다른 지점).** T-1538 은
`person-detail-read` 가 **보수 분류(유보)** 였기에 그 유보를 해소하는 문장을 새로 썼지만,
`part-detail-read` 는 애초에 유보가 아니라 **"slice 7 은 목록과 `:id/persons` 만 쟀다"** 는 확정
근거로 (B) 였다. 따라서 보수 분류 단락은 **`import-detail-read` 1 건 그대로** 이고 T-1538 의
"유보가 해소됐다" 문형을 slice 20 에 복사하면 **거짓 서술** 이 된다.

아울러 T-1539 가 주장한 **구조 축 3 개** 를 박제한다 — ① **합성 route 의 구성 성분 query 를 분리해
재는 첫 페어** (slice 7 이 잰 `:id/persons` 는 `PartService.findPersonsByPartId` 가 내부에서
`this.findById(partId)` 를 먼저 호출한 뒤 자식 조회를 태우는 요청당 상수 2 query 경로인데, 본 route
는 **그 첫 query 만 단독 노출된 route** — slice 19 의 페어가 같은 테이블의 집합 ↔ 단일 row 였던 것과
달리 본 페어는 **합성 경로 ↔ 그 부분 경로** 다), ② **404 를 공유하는 두 route 의 거절 경로 관측**
(두 route 의 404 가 같은 `findById` 의 null 분기 **한 곳** 에서 나오고 자식 목록 route 의 404 도 자식
조회가 아니라 **부모 검증 query** 가 낸다), ③ **규모 축이 "자식 row 수" 인데 단건 응답은 무반응**
(`include` 0 이라 자식 0 건 Part 와 자식 40 건 Part 의 응답이 동일한 4 scalar 컬럼 형태로 고정 —
대소·증가율 **미단언**). **새 축이 아닌 것** 도 병기한다 — PK 직행 `findUnique` 는 slice 11·14·19 와
동일, null → 404 분기는 slice 11·19 와 동일, `include` 0 의 미조인 SELECT 는 slice 11·19 와 동일,
**guard 미부착(401 / 403 구조적 부재) 은 slice 1·2·7·19 와 동일**, 한 controller 의 조회 route 전량
실측 도달도 slice 18·19 선례가 있어 새 축이 아니다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 20** bullet (`871 행` 부근) 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이
  파일을 **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1539-perf-realdb-slice20-part-detail-read.md](T-1539-perf-realdb-slice20-part-detail-read.md) —
  `## Why` 의 구조 축 · `## 결과` 의 실측 결과 · `## Follow-ups (실행 후 추가)` 의 doc-sync 요구.
- [test/perf/part-detail-read-realdb.perf-spec.ts](../../test/perf/part-detail-read-realdb.perf-spec.ts) 의
  헤더 주석과 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **53 개**(그중 read 경로
  **48 개** … T-0830~T-1537)" · "실 DB round-trip 실측이 **slice 19 까지 도달**" · 잔여 절의 "실측
  범위가 endpoint **14 개(조회 route 28)** 뿐" 이 slice 19 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "slice 19 까지 도달"(`135 행`), slice 19 서술(`401 행` 부근), 셈법 서술(`424 행` ·
  `428 행` 부근), 계산식 "read 48 개 − 실 DB read 18 개"(`436 행` 부근), 규모 민감도 잔여 목록
  (`445 행` · `458 행` 부근), 그리고 **잔여 read route 인벤토리**(`464 행` 이후) 의 머리말 실측 4 종
  (`469 행` 부근) · (A) 제목과 표(`474 행` 이후, 현재 마지막 행 `504 행`) · (B) 제목과 목록
  (`510~516 행` 부근) · 보수 분류 단락(`517 행` 부근) · (C) 절(`522 행` 부근) · 자체 검산(`532 행` 부근).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~19 서술과 endpoint 개수 · "나머지 read perf-spec 30 개" 계산식이 있다.
  **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1538 선례 —
  `||` 표기를 "OR 분기" 로 우회했다).
- [T-1538](T-1538-perf-realdb-slice19-doc-sync.md) — 직전 선례이자 본 task 의 구조·문체 mirror.
  **완료 선언 금지 · checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을 그대로 승계한다. 단 그 task 의
  **"보수 분류 유보 해소"** 서술은 slice 20 에 **복사 금지** (계수 함정 ③).

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **54** · **49** · **20** ·
  **19** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는
  `915f7859` (PR #1230) 이고, test 수는
  `grep -c "^\s*it(" test/perf/part-detail-read-realdb.perf-spec.ts` 의 실측값 (**12**) 을 쓴다.
- [ ] **AC 2 — 계수 함정 ① 검산.** slice 20 파일명에도 `read` 가 **있어** `*read*` glob 개수가
  **48 → 49** 로 증가하지만, 실 DB read 파일도 **18 → 19** 로 함께 늘어 **"mock 잔존 read perf-spec
  30 개" 는 여전히 불변** 이다 (49 − 19 = 30). 세 문서에서 이 30 을 잘못 증감시키지 않고, 계산식
  서술(`read 48 개 − 실 DB read 18 개`) 은 **`read 49 개 − 실 DB read 19 개`** 로 갱신하며 결과가
  같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — 계수 함정 ② (도메인 불변 + route 만 증가) 반영.** slice 20 의 측정 대상
  `PartController` 는 slice 7(T-1512) 에서 **이미 실측된 도메인** 이므로 endpoint 도메인은 **14 불변**
  이고 조회 route 만 **28 → 29** 로 는다. slice 16 의 "도메인과 route 를 각각 1 개씩" 서술을 **복사하지
  않고**, slice 20 이 **slice 15·17·18·19 와 같은 셈법** 이며 `PartController` 를 **두 번째로 재는
  slice** 라는 점을 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 4 — 계수 함정 ③ (보수 분류 단락 불변) 준수.** 부하계획의 **보수 분류 표기** 단락은
  **`import-detail-read` 1 건 그대로 유지** 하고, `part-detail-read` 에 대해 "유보가 해소됐다" 류
  문장(T-1538 이 `person-detail-read` 에 쓴 문형) 을 **새로 쓰지 않는다** — 본 route 는 애초에 유보가
  아니라 "slice 7 은 목록과 `:id/persons` 만 쟀다" 는 확정 근거로 (B) 였다. `person-detail-read` 의
  유보 해소 이력 문장은 **삭제하지 않고 그대로 보존** 한다.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `53` → **54**, read 경로 `48` → **49**, glob
  증가 서술을 **slice 20 기준(48 → 49)** 으로 정정, 범위 표기 `T-0830~T-1537` → **`T-0830~T-1539`**
  로 정정, ② "실 DB round-trip 실측이 **slice 19 까지 도달**" → **slice 20 까지 도달** 로 확장하고
  `part-detail-read-realdb.perf-spec.ts` (T-1539, main `915f7859`, 12 test) 가 **`PartController` 의
  단건 상세 1 route (`GET /api/parts/:id`) 를 실 부트스트랩으로 측정해 p95 < 3000ms 임을 실측** 했다는
  1 ~ 2 문장 추가 (**합성 route 의 구성 성분 query 를 분리해 재는 첫 페어** + **404 를 공유하는 두
  route 의 거절 경로 관측(부모 검증 query 가 404 를 낸다)** + **규모 축이 자식 row 수인데 `include` 0
  이라 단건 응답이 무반응(대소·증가율 미단언)** 3 축 병기, 아울러 **PK 직행 `findUnique` · null → 404
  분기 · 미조인 SELECT · guard 미부착(401 / 403 구조적 부재) 은 각각 slice 11·14·19 / slice 11·19 /
  slice 11·19 / slice 1·2·7·19 와 동일해 새 축 아님** 1 구절), ③ 잔여 서술의 범위를 **endpoint 14 개
  (조회 route 28) → endpoint 14 개(조회 route 29)** 로 갱신하고 slice 20 이 **도메인을 늘리지 않고
  route 만 더했음** 을 기존 순서 나열에 이어 적는다 (AC 3), ④ task 링크 목록에 T-1539 추가.
  **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 19 까지 도달" 서술(`135 행`)에 slice 20
  (T-1539, main `915f7859`, 12 test) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술의 **14 endpoint
  (조회 28 route)**(`424 행` 부근) 를 **14 endpoint (조회 29 route)** 로 갱신한다 (`428 행` 부근 셈법
  문장에 slice 20 도 slice 15·17·18·19 와 같은 셈법임을 이어 적는다). `**잔여**` 구절의 "나머지 read
  perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`436 행` 부근)만 갱신한다.
  규모 민감도 잔여 목록(`445 행` · `458 행` 부근)에는 **slice 20 의 part 단건 상세 조회** 도 덧붙이되,
  본 slice 의 규모 축은 **같은 테이블 총 row 수가 아니라 자식 `Person` 수** 이고 `include` 0 이라
  **응답이 자식 fan-out 에 반응하지 않아** 두 표본 모두 관측 기록으로만 남겼으며(대소·증가율 미단언)
  **REQ-047 실 scale 부하와는 무관한 소규모 표본** 이라는 1 구절을 병기한다 — 미측정 목록에 통째로
  넣지도, 규모 축이 해소된 것처럼 적지도 않는다. **"본 item 은 미완" 결론은 그대로 유지** —
  `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 7 — 인벤토리 (A)/(B) 재분류 (본 task 고유).** 부하계획 `§ 5` item 5 의 **잔여 read route
  인벤토리**(`464 행` 이후) 를 다음 5 지점 모두 갱신한다 — ① 머리말의 "slice 19 시점 확인분, T-1536
  작성 → T-1538 갱신" 을 **"slice 20 시점 확인분, T-1536 작성 → T-1540 갱신"** 취지로 정정하고 편집 전
  실측 개수 4 종 (`53`·`48`·`19`·`18`) 을 **`54`·`49`·`20`·`19`** 로 갱신, ② (A) 제목을 **27 개 →
  28 개** 로 고치고 표 끝에
  `| part-detail-read | GET /api/parts/:id | slice 20 (part-detail-read-realdb) |` 행 1 개 추가,
  ③ (B) 제목을 **3 개 → 2 개** 로 고치고 `part-detail-read` bullet **삭제**
  (`import-detail-read` · `app-root-read` 2 개는 **문구 그대로 보존**), ④ 보수 분류 단락은 **불변**
  (AC 4), ⑤ **자체 검산** 을 **`A + B = 28 + 2 = 30`** ↔ **`read 49 − 실 DB read 19 = 30`** 으로
  갱신한다. 두 셈이 어긋나면 문서가 아니라 분류를 고친다.
- [ ] **AC 8 — 인벤토리 (C) 절 검산식 갱신 (0 건 불변).** (C) 절(`522 행` 부근) 의 등식
  **`실측 28 + (B) 3 = 31`** 을 **`실측 29 + (B) 2 = 31`** 로 갱신한다 — 조회 route 총 **31 은 불변**
  이고 **(C) 는 여전히 0 건** 이다. slice 18 이 (C) 였다가 해소된 선례 서술과 `AppController` root 가
  `app-root-read.perf-spec.ts` 실존으로 (B) 분류라는 서술은 **그대로 보존** 하고, "본 절은 완전 열거를
  주장하지 않는다 — 현 시점 확인분" 이라는 유보 문장도 삭제하지 않는다.
- [ ] **AC 9 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 20 을 반영한다 — 파일명 · task · main SHA · test 수(12) · **질적 차이 3 축
  (합성 route 의 구성 성분 query 분리 페어 / 404 를 공유하는 두 route 의 거절 경로 / 규모 축이 자식
  row 수인데 `include` 0 이라 단건 응답 무반응)** · 조회 1 route · "endpoint 수 **14 개 불변 (조회
  29 route)**" · 계산식 `read 49 개 − 실 DB read 19 개` (차이 30 불변). **status 토큰 `IN_PROGRESS` 는
  불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완"
  서술도 불변.
- [ ] **AC 10 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1538 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다. 부하계획
  (A) 표에 새로 넣는 행은 **정확히 3 셀**(mock spec / route / 실측 slice) 이어야 하며 편집 후
  기존 27 행 + 신규 1 행 = **28 행** 임을 확인한다.
- [ ] **AC 11 — `PartController` 재판정 0.** 세 문서 어디에도 slice 20 이 관측한 **guard 부재
  (401 / 403 구조적 부재)** · **`findById` 의 `include` 0** · **`findPersonsByPartId` 의 상수 2 query**
  를 **결함 · 수정 필요** 로 읽히게 적지 않는다 — 본 doc-sync 는 현재 동작을 **판단 없이 인용만** 하며,
  `Part` index 추가 · guard 부착 여부는 별도 판단이다. 관련 REQ 행(REQ-026 등) 은 **수정하지 않는다**.
- [ ] **AC 12 — REQ-047 오독 차단.** 세 문서 어디에도 slice 20 이 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. 표본은 상대 비교용
  소규모(자식 0 건 / 40 건 수준 · 반복 소수 회)임을 오독 여지 없이 서술하고, REQ-047 행 (`66 행`) 은
  **수정하지 않는다**.
- [ ] **AC 13 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint 의 규모 민감도 미측정(목록에 **part 단건 상세 포함**), (c) baseline 파일 확정 ·
  임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도
  삭제됐으면 되돌린다.
- [ ] **AC 14 — 완료 선언 0 검산.** 세 파일의 diff 에서 (a) PLAN `140 행` 부근 성능 검증 checkbox 가
  `[ ]` 그대로, (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획 `§ 5` item 5 가 여전히
  미완으로 읽히는지 세 지점을 각각 확인한다. 셋 중 하나라도 완료로 읽히면 문장을 되돌린다. 인벤토리
  (B) 가 3 → 2 로 줄었다고 해서 **잔여가 곧 소진 임박** 인 것처럼 읽히는 표현도 쓰지 않는다 ((A) 부류
  mock spec 의 retire 판단은 여전히 미착수이고 write / trigger route 는 애초에 목록 밖이다).
- [ ] **AC 15 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1539 가 이미 slice 20
  항목과 잔여 계수를 박제했다 — 인용만).
- **perf slice 21 착수** — 인벤토리 (B) 잔여 2 후보(`GET /api/admin/import/:id` · `GET /api`) 중
  무엇을 다음 slice 로 할지 **결정하지도 측정하지도 않는다**. 우선순위 부여는 planner 의 다음 호출 몫이다.
- **(A) 부류 mock perf-spec 의 retire · 삭제 · 통합** — 특히 이번에 (A) 로 옮겨가는
  [`part-detail-read.perf-spec.ts`](../../test/perf/part-detail-read.perf-spec.ts) 를 지울지 남길지는
  T-1536 이 명시적으로 유보한 별도 판단이다 (`test/` 변경이라 `pr`). Follow-ups 에만 적는다.
- **`PartController` guard 부재 · `findById` 의 `include` 0 · `findPersonsByPartId` 2 query 구조에
  대한 재판정** — 본 doc-sync 는 현재 동작을 **판단 없이 인용만** 하고 REQ 재판정을 하지 않는다
  (AC 11). 필요 판단이 서면 Follow-ups 에만 적는다.
- **production code 변경 · index 튜닝 · pagination 도입** — `Part` index 추가는 **schema 변경이라 §5
  BLOCKED 대상** 이다. Follow-ups 에만 적는다.
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지 (AC 13 · AC 14).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 12) · **REQ-026 / REQ-028 / REQ-030 / REQ-045 행 재판정** —
  본 slice 의 측정 대상은 latency 일 뿐 part 조회 기능·보안 요건 재판정이 아니다.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 15).
- **ADR status flip · 새 dependency 도입 · `docs/architecture/*` 편집** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
