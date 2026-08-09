---
id: T-1542
title: 실 DB round-trip slice 21(T-1541) import job 단건 상세 조회 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: DONE
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 120
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T11:20:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1541]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1541 Follow-ups 가 이월한 direct doc-sync — PLAN 142 행 slice 20 → 21 · 도메인 14 불변 · 조회 route 29 → 30 + 부하계획 §5 item 5 인벤토리 (A) 28 → 29 / (B) 2 → 1 + 보수 분류 잔여 1 → 0"
---

# T-1542 — 실 DB round-trip slice 21 doc-sync (`ImportController` `GET /api/admin/import/:id`)

## Why

[T-1541](T-1541-perf-realdb-slice21-import-detail-read.md) 이 PR #1231 로 머지돼 (main `212b82b9`)
`test/perf/import-detail-read-realdb.perf-spec.ts` 가 `ImportController` 의 job 단건 상세 조회 route
(`GET /api/admin/import/:id`) 를 실 Postgres 부트스트랩으로 측정했다. 그런데 T-1541 의 `## Follow-ups`
가 [CLAUDE.md](../../CLAUDE.md) §3.1 rule 3 (direct·pr mixed 금지) 에 따라 PLAN · 부하계획 · REQ-048
갱신을 **머지 후 별도 direct task** 로 명시 이월했다.

그 결과 3 문서가 아직 **slice 20 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 20 까지 도달"** 과 **"endpoint 14 개(조회 route 29)"** 는 slice 21 이
조회 route 를 하나 더 실측하면서 이미 **stale** 해졌다. [test/perf/README.md](../../test/perf/README.md)
는 T-1541 이 이미 slice 21 항목과 잔여 계수를 박제했으므로 본 task 는 그 정본을 **인용만** 한다.
본 task 는 [T-1538](T-1538-perf-realdb-slice19-doc-sync.md) ·
[T-1540](T-1540-perf-realdb-slice20-doc-sync.md) 가 slice 19~20 에 대해 수행한 doc-sync 의
**slice 21 판** 이다.

**본 doc-sync 고유 대상 ① — 인벤토리 (A)/(B) 재분류 세 번째.** 부하계획 `§ 5` item 5 의 **잔여 read
route 인벤토리** 는 `import-detail-read` → `GET /api/admin/import/:id` 를 **(B) 진짜 잔여 후보** 로
두고 있다. slice 21 이 그 route 를 happy-path 로 실측했으므로 (A) **28 → 29** (표에 slice 21 행 추가),
(B) **2 → 1** (`import-detail-read` 제거, `app-root-read` 만 잔존) 로 옮기고 자체 검산
`A + B = 29 + 1 = 30` 을 맞춘다. (C) 는 **0 건 불변** 이되 그 검산식 `실측 29 + (B) 2 = 31` 은
**`실측 30 + (B) 1 = 31`** 로 바뀐다 (조회 route 총 31 은 불변).

**본 doc-sync 고유 대상 ② — 보수 분류 잔여가 1 → 0 이 된다 (T-1540 과 정반대 지점).** T-1540 은
`part-detail-read` 가 애초에 유보가 아니었기에 보수 분류 단락을 **불변** 으로 뒀지만,
`import-detail-read` 는 **바로 그 보수 분류 1 건** 이었다 (slice 12 가 `no-such-job-id` 404 negative
로만 두드려 happy-path 근거를 못 찾은 자리). slice 21 이 happy-path 로 실측했으므로 그 유보는
**해소** 되고 보수 분류 목록은 **0 건** 이 된다 — T-1538(`person-detail-read`) 에 이은 **두 번째
해소 사례** 다. 단 해소 이력 문장 2 건(person / import) 은 **삭제하지 않고 보존** 한다 ("보수 분류는
근거가 생기면 풀린다" 는 방법론 기록이므로).

**계수 함정 ① — mock 잔존 30 은 이번에도 불변.** slice 21 파일명에도 `read` 가 있어 `*read*` glob 이
**49 → 50** 으로 늘지만 실 DB read 도 **19 → 20** 으로 함께 늘어 `50 − 20 = 30` 으로 **여전히 30** 이다.
세 문서에서 이 30 을 잘못 증감시키지 않는다.

**계수 함정 ② — 도메인은 늘지 않는다.** slice 21 의 `ImportController` 는 slice 12(T-1522) 에서 **이미
실측된 도메인** 이므로 endpoint 도메인은 **14 불변** 이고 조회 route 만 **29 → 30** 으로 는다 — slice
15·17·18·19·20 과 같은 셈법이고 slice 16 과는 반대다.

**계수 함정 ③ — (B) 1 을 "소진 임박" 으로 적지 않는다.** (B) 가 1 로 줄어 남은 cutover 후보가
`GET /api` 하나뿐이지만, (A) 부류 mock spec 의 retire 판단은 여전히 미착수이고 write / trigger route
는 애초에 목록 밖이며 REQ-047 실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정 4 잔여 축은
그대로다. 완료 임박으로 읽히는 표현을 쓰지 않는다.

아울러 T-1541 이 주장한 **구조 축** 을 박제한다 — **같은 depth 의 정적 세그먼트 2 종(`modes` ·
`running`) 과 동적 `:id` 의 라우팅 우선순위** (정적 route 가 이겨 `"modes"` / `"running"` 문자열은
404 가 아니라 200 이 되므로 `:id` 로 도달 불가능한 id 공간이 존재한다는 실측 증거. slice 10 의
`ExportController` 는 같은 depth 정적이 `running` 1 종이라 2 종 대상은 본 slice 가 처음). **새 축이
아닌 것** 도 병기한다 — `findUniqueOrThrow` 의 P2025 → `NotFoundException` 변환은 slice 10 과 동일,
job status enum 4 상태 표본도 slice 10 과 동일, `JwtAuthGuard + RolesGuard` + `@Roles("Admin")` 의
401 / 403 layer 는 slice 10·11·12 와 동일, PK 직행 단건 조회는 slice 11·14·19·20 과 동일, 한
controller 의 조회 route 전량 실측 도달도 slice 18·19·20 선례가 있어 새 축이 아니다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 21** bullet 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1541-perf-realdb-slice21-import-detail-read.md](T-1541-perf-realdb-slice21-import-detail-read.md) —
  `## Why` 의 구조 축 · `## 결과` 의 실측 결과 · `## Follow-ups (실행 후 추가)` 의 doc-sync 요구.
- [test/perf/import-detail-read-realdb.perf-spec.ts](../../test/perf/import-detail-read-realdb.perf-spec.ts) 의
  헤더 주석과 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **54 개**(그중 read 경로
  **49 개** … T-0830~T-1539)" · "실 DB round-trip 실측이 **slice 20 까지 도달**" · 말미 계수 나열
  "(perf-spec 54 / read 49 / 실 DB 20 / read 19 / 도메인 14 / 조회 route 29)" 가 slice 20 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "slice 20 까지 도달"(`135 행`), slice 20 서술(`422 행` 부근), 재분류 이력 서술
  (`418 행` · `441~443 행` 부근), 셈법 서술(`454 행` 부근), 계산식 "read 49 개 − 실 DB read 19 개"
  (`462 행` 부근), 규모 민감도 잔여 목록(`471 행` · `486 행` 부근), 그리고 **잔여 read route
  인벤토리**(`494 행` 이후) 의 머리말 실측 4 종(`499 행` 부근) · (A) 표(현재 마지막 행 `535 행`) ·
  (B) 제목과 목록(`540~543 행` 부근) · **보수 분류 단락**(`545~550 행` 부근) · (C) 절(`553 행` 부근
  검산식 `555 행`) · 자체 검산(`562 행` 부근) · 오독 차단 단락(`567 행` 부근).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — **실 DB 축은
  부분 해소**" 이하에 slice 1~20 서술과 endpoint 개수 · "나머지 read perf-spec 30 개" 계산식이 있다.
  **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1540 선례 —
  `||` 표기를 "OR 분기" 로 우회했다).
- [T-1538](T-1538-perf-realdb-slice19-doc-sync.md) — **보수 분류 유보 해소** 문형의 선례 (본 task 는
  그 두 번째 사례라 이 문형을 이어 쓴다). [T-1540](T-1540-perf-realdb-slice20-doc-sync.md) — 직전
  선례이자 본 task 의 구조·문체 mirror. 두 task 의 **완료 선언 금지 · checkbox `[ ]` 유지 ·
  `IN_PROGRESS` 유지** 원칙을 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **55** · **50** · **21** ·
  **20** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는
  `212b82b9` (PR #1231) 이고, test 수는
  `grep -c "^\s*it(" test/perf/import-detail-read-realdb.perf-spec.ts` 의 **실측값** 을 쓴다
  (T-1541 `## 결과` 의 "9 종" 은 test 카테고리 셈이므로 문서 계수로 쓰지 않는다 — 선례 T-1540 과
  동일하게 `it(` 실측값이 정본이다).
- [ ] **AC 2 — 계수 함정 ① 검산.** slice 21 파일명에도 `read` 가 **있어** `*read*` glob 개수가
  **49 → 50** 으로 증가하지만, 실 DB read 파일도 **19 → 20** 으로 함께 늘어 **"mock 잔존 read
  perf-spec 30 개" 는 여전히 불변** 이다 (50 − 20 = 30). 세 문서에서 이 30 을 잘못 증감시키지 않고,
  계산식 서술(`read 49 개 − 실 DB read 19 개`) 은 **`read 50 개 − 실 DB read 20 개`** 로 갱신하며
  결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — 계수 함정 ② (도메인 불변 + route 만 증가) 반영.** slice 21 의 측정 대상
  `ImportController` 는 slice 12(T-1522) 에서 **이미 실측된 도메인** 이므로 endpoint 도메인은
  **14 불변** 이고 조회 route 만 **29 → 30** 으로 는다. slice 16 의 "도메인과 route 를 각각 1 개씩"
  서술을 **복사하지 않고**, slice 21 이 **slice 15·17·18·19·20 과 같은 셈법** 이며
  `ImportController` 를 **두 번째로 재는 slice** 라는 점을 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 4 — 보수 분류 잔여 1 → 0 반영 (본 task 고유 ②).** 부하계획의 **보수 분류 표기** 단락
  (`545~550 행` 부근) 을 다음과 같이 갱신한다 — ① `import-detail-read` **1 건 만 남는다** 서술을
  **"현재 보수 분류 잔여는 0 건"** 취지로 정정하고, ② slice 21(T-1541) 이
  `GET /api/admin/import/:id` 를 **happy-path 로 실측하면서 그 유보가 해소** 돼 (A) 로 옮겼다는
  1 ~ 2 문장을 추가하며 (T-1538 이 `person-detail-read` 에 쓴 문형을 이어 **두 번째 해소 사례** 로
  명기), ③ `person-detail-read` 의 해소 이력 문장은 **삭제하지 않고 그대로 보존** 한다. "보수 분류는
  근거가 생기면 풀린다" 는 방법론 문장도 유지한다.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `54` → **55**, read 경로 `49` → **50**, glob
  증가 서술을 **slice 21 기준(49 → 50)** 으로 정정, 범위 표기 `T-0830~T-1539` → **`T-0830~T-1541`**
  로 정정, ② "실 DB round-trip 실측이 **slice 20 까지 도달**" → **slice 21 까지 도달** 로 확장하고
  `import-detail-read-realdb.perf-spec.ts` (T-1541, main `212b82b9`, `it(` 실측 수) 가
  **`ImportController` 의 job 단건 상세 1 route (`GET /api/admin/import/:id`) 를 실 부트스트랩으로
  측정해 p95 < 3000ms 임을 실측** 했다는 1 ~ 2 문장 추가 (**같은 depth 정적 2 종(`modes` · `running`)
  vs `:id` 의 라우팅 우선순위 실측** 축 + **slice 12 가 404 negative 로만 두드려 보수 분류돼 있던
  자리를 happy-path 로 해소** 1 구절 병기, 아울러 **P2025 → 404 변환 · job status enum 4 표본 ·
  Admin guard 401/403 layer · PK 직행 단건 조회는 각각 slice 10 / slice 10 / slice 10·11·12 /
  slice 11·14·19·20 과 동일해 새 축 아님** 1 구절), ③ 말미 계수 나열을 **perf-spec 55 / read 50 /
  실 DB 21 / read 20 / 도메인 14 / 조회 route 30** 으로 갱신, ④ task 링크 목록에 T-1541 (및 doc-sync
  T-1540 뒤에 본 task 계열 링크 자리) 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 20 까지 도달" 서술(`135 행`)에 slice 21
  (T-1541, main `212b82b9`, `it(` 실측 수) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술의
  **14 endpoint (조회 29 route)** 를 **14 endpoint (조회 30 route)** 로 갱신한다 (`454 행` 부근 셈법
  문장에 slice 21 도 slice 15·17·18·19·20 과 같은 셈법임을 이어 적는다). `**잔여**` 구절의 "나머지
  read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되 계산식(`462 행` 부근)만
  갱신한다. 재분류 이력 서술(`418 행` · `441~443 행` 부근) 에는 slice 21 이 **(B) → (A) 세 번째
  재분류** 이고 **보수 분류 유보 해소로는 두 번째** 임을 1 구절로 덧붙인다. 규모 민감도 잔여 목록
  (`471 행` · `486 행` 부근)에는 **slice 21 의 import job 단건 상세 조회** 도 덧붙이되, 본 slice 는
  규모 축을 재지 않았고 표본이 **REQ-047 실 scale 부하와 무관한 소규모(job 4 row 수준)** 임을 1 구절로
  병기한다 — 규모 축이 해소된 것처럼 적지 않는다. **"본 item 은 미완" 결론은 그대로 유지** —
  `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 7 — 인벤토리 (A)/(B) 재분류 (본 task 고유 ①).** 부하계획 `§ 5` item 5 의 **잔여 read route
  인벤토리**(`494 행` 이후) 를 다음 5 지점 모두 갱신한다 — ① 머리말의 "slice 20 시점 확인분, T-1536
  작성 → T-1540 갱신" 을 **"slice 21 시점 확인분, T-1536 작성 → T-1542 갱신"** 취지로 정정하고 편집
  전 실측 개수 4 종 (`54`·`49`·`20`·`19`) 을 **`55`·`50`·`21`·`20`** 으로 갱신, ② (A) 제목을
  **28 개 → 29 개** 로 고치고 표 끝에
  `| import-detail-read | GET /api/admin/import/:id | slice 21 (import-detail-read-realdb) |`
  행 1 개 추가, ③ (B) 제목을 **2 개 → 1 개** 로 고치고 `import-detail-read` bullet **삭제**
  (`app-root-read` bullet 은 **문구 그대로 보존**), ④ 보수 분류 단락은 AC 4 대로 갱신,
  ⑤ **자체 검산** 을 **`A + B = 29 + 1 = 30`** ↔ **`read 50 − 실 DB read 20 = 30`** 으로 갱신한다.
  두 셈이 어긋나면 문서가 아니라 분류를 고친다.
- [ ] **AC 8 — 인벤토리 (C) 절 검산식 갱신 (0 건 불변).** (C) 절(`553~555 행` 부근) 의 등식
  **`실측 29 + (B) 2 = 31`** 을 **`실측 30 + (B) 1 = 31`** 로 갱신한다 — 조회 route 총 **31 은 불변**
  이고 **(C) 는 여전히 0 건** 이다. slice 18 이 (C) 였다가 해소된 선례 서술과 `AppController` root 가
  `app-root-read.perf-spec.ts` 실존으로 (B) 분류라는 서술은 **그대로 보존** 하고, "본 절은 완전 열거를
  주장하지 않는다 — 현 시점 확인분" 이라는 유보 문장도 삭제하지 않는다.
- [ ] **AC 9 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행의 "한계 — 실 DB 축은 부분
  해소" 문장에 slice 21 을 반영한다 — 파일명 · task · main SHA · test 수(`it(` 실측) · **질적 차이
  (같은 depth 정적 2 종 vs `:id` 라우팅 우선순위 · 보수 분류 유보의 happy-path 해소)** · 조회 1 route ·
  "endpoint 수 **14 개 불변 (조회 30 route)**" · 계산식 `read 50 개 − 실 DB read 20 개` (차이 30 불변).
  **status 토큰 `IN_PROGRESS` 는 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" ·
  "baseline 확정 · 임계 fix 미완" 서술도 불변.
- [ ] **AC 10 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1540 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 불변을 확인한다. 부하계획
  (A) 표에 새로 넣는 행은 **정확히 3 셀**(mock spec / route / 실측 slice) 이어야 하며 편집 후
  기존 28 행 + 신규 1 행 = **29 행** 임을 확인한다.
- [ ] **AC 11 — `ImportController` 재판정 0.** 세 문서 어디에도 slice 21 이 관측한 **정적 route 가
  `:id` 를 이기는 선언 순서** · **`:id` 로 도달 불가능한 id 공간** · **`findJob` 의 미조인 SELECT** 를
  **결함 · 수정 필요** 로 읽히게 적지 않는다 — 본 doc-sync 는 현재 동작을 **판단 없이 인용만** 하며,
  route 선언 순서 변경 · `ImportJob` index 추가 여부는 별도 판단이다. 관련 REQ 행(REQ-057 등) 은
  **수정하지 않는다**.
- [ ] **AC 12 — REQ-047 오독 차단.** 세 문서 어디에도 slice 21 이 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. 표본은 상대 비교용
  소규모(job 4 row 수준 · 반복 소수 회)임을 오독 여지 없이 서술하고, REQ-047 행 (`66 행`) 은
  **수정하지 않는다**.
- [ ] **AC 13 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint 의 규모 민감도 미측정(목록에 **import 단건 상세 포함**), (c) baseline 파일 확정 ·
  임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도
  삭제됐으면 되돌린다.
- [ ] **AC 14 — 완료 선언 0 검산 (계수 함정 ③ 포함).** 세 파일의 diff 에서 (a) PLAN `140 행` 부근
  성능 검증 checkbox 가 `[ ]` 그대로, (b) REQ-048 status 가 `IN_PROGRESS` 그대로, (c) 부하계획
  `§ 5` item 5 가 여전히 미완으로 읽히는지 세 지점을 각각 확인한다. 특히 **(B) 가 2 → 1 로 줄고 보수
  분류가 0 건이 됐다고 해서 "잔여 소진 임박" 으로 읽히는 표현을 쓰지 않는다** — 오독 차단 단락
  (`567 행` 부근) 의 `(B) + (C) = 2 + 0 = 2` 를 **`1 + 0 = 1`** 로 갱신하되 그 단락의 유보 문장((A)
  부류 retire 미착수 · write / trigger route 는 목록 밖 · 30 은 잔여의 상한도 하한도 아님) 은 그대로
  보존한다.
- [ ] **AC 15 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요).

## Out of Scope

- **코드·spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1541 이 이미 slice 21
  항목과 잔여 계수를 박제했다 — 인용만).
- **perf slice 22 착수** — 인벤토리 (B) 잔여 1 후보(`GET /api` — `app-root-read`) 를 다음 slice 로
  측정하지 않는다. 착수 여부·순서 결정은 planner 의 다음 호출 몫이다.
- **(A) 부류 mock perf-spec 의 retire · 삭제 · 통합** — 특히 이번에 (A) 로 옮겨가는
  [`import-detail-read.perf-spec.ts`](../../test/perf/import-detail-read.perf-spec.ts) 를 지울지
  남길지는 T-1536 이 명시적으로 유보한 별도 판단이다 (`test/` 변경이라 `pr`). Follow-ups 에만 적는다.
- **`app-root-measure-confirm.perf-spec.ts` 의 timing-fragile 이력 (T-0877 · T-0880 · T-0881)
  재판정** — `GET /api` 관련 서술을 본 doc-sync 에서 확장하지 않는다.
- **`ImportController` 의 route 선언 순서 · guard 구성 · `findJob` 미조인 SELECT 에 대한 재판정** —
  본 doc-sync 는 현재 동작을 **판단 없이 인용만** 하고 REQ 재판정을 하지 않는다 (AC 11).
- **production code 변경 · index 튜닝 · pagination 도입** — `ImportJob` index 추가는 **schema 변경이라
  §5 BLOCKED 대상** 이다. Follow-ups 에만 적는다.
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지 (AC 13 · AC 14).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 12) · **REQ-057 / REQ-026 / REQ-045 행 재판정** — 본 slice 의
  측정 대상은 latency 일 뿐 import 기능·보안 요건 재판정이 아니다.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 15).
- **ADR status flip · 새 dependency 도입 · `docs/architecture/*` 편집** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)

## 결과 (2026-08-09T12:41:00Z, DONE)

- commit `42d4de30` (`direct`, main) — `docs/PLAN.md` + `docs/ops/load-resilience-test-plan.md`
  + `docs/requirements.md` **3 파일 `+50/-21`** (cap 300 LOC / 5 파일 이내).
- 실측 계수 반영: perf-spec **55** / read glob **50** / 실 DB **21**(read **20**) / 도메인 **14 불변**
  / mock 잔존 **30 불변** / 조회 route **29 → 30**.
- 부하계획 `§ 5` item 5 인벤토리 (A) **28 → 29** · (B) **2 → 1** 재분류 + **보수 분류 잔여 1 → 0**
  (해소 이력 2 건 보존), (C) 검산식 `실측 30 + (B) 1 = 31` 갱신 (0 건 불변).
- 완료 선언 **0 유지** — PLAN `142 행` checkbox `[ ]` · REQ-048 `IN_PROGRESS` · 잔여 축 4 종 보존.
- AC 1~15 전부 ok. 코드 변경 0 의 doc-only 라 architect · tester 미호출.
