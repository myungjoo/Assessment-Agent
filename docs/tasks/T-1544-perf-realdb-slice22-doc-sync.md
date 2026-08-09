---
id: T-1544
title: 실 DB round-trip slice 22(T-1543) GET /api DB 미접촉 floor 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T15:42:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1543]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1543 Follow-ups 가 이월한 direct doc-sync — PLAN 142 행 slice 21 → 22 · 도메인 14 → 15 · 조회 route 30 → 31 + 부하계획 §5 item 5 인벤토리 (A) 29 → 30 / (B) 1 → 0 + 완료 선언 0 유지"
---

# T-1544 — 실 DB round-trip slice 22 doc-sync (`AppController` `GET /api`)

## Why

[T-1543](T-1543-perf-realdb-slice22-app-root-read.md) 이 PR [#1232](https://github.com/myungjoo/AA_S1/pull/1232)
round 1 로 머지돼 (main `56771076`) `test/perf/app-root-read-realdb.perf-spec.ts` 가 `AppController`
root read (`GET /api`) 를 **mock override 0** 인 실 `AppModule` 부트스트랩 + 실 Prisma 연결 하에서
측정했다. 그런데 T-1543 의 `## Follow-ups` 가 [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3
(direct · pr mixed 금지) 에 따라 PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로
명시 이월했다.

그 결과 3 문서가 아직 **slice 21 시점 전제** 로 서술돼 있고, 특히 [PLAN.md](../PLAN.md) `142 행` 의
**"실 DB round-trip 실측이 slice 21 까지 도달"** 과 말미 계수 나열은 이미 **stale** 하다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1543 이 이미 slice 22 항목과 잔여 계수를
박제했으므로 본 task 는 그 정본을 **인용만** 한다. 본 task 는
[T-1540](T-1540-perf-realdb-slice20-doc-sync.md) · [T-1542](T-1542-perf-realdb-slice21-doc-sync.md)
가 slice 20~21 에 대해 수행한 doc-sync 의 **slice 22 판** 이다.

**본 doc-sync 고유 대상 ① — 인벤토리 (B) 가 1 → 0 이 되는 첫 사례.** 부하계획 `§ 5` item 5 의
**잔여 read route 인벤토리** 는 `app-root-read` → `GET /api` 를 (B) **진짜 잔여 cutover 후보** 로
1 건 남겨 두고 있었다 (`569 행`). slice 22 가 그 route 를 실 부트스트랩으로 실측했으므로
(A) **29 → 30** (표에 slice 22 행 추가), (B) **1 → 0** (`app-root-read` bullet 제거 → 목록이 비게 됨)
으로 옮기고 자체 검산 `A + B = 30 + 0 = 30` 을 맞춘다. (C) 는 **0 건 불변** 이되 그 검산식
`실측 30 + (B) 1 = 31` 은 **`실측 31 + (B) 0 = 31`** 로 바뀐다 (조회 route 총 31 은 불변).

**본 doc-sync 고유 대상 ② — 도메인이 이번엔 는다 (직전 6 slice 와 반대 셈법).** slice 22 의 측정
대상 `AppController` 는 실측 endpoint 도메인 14 개에 **없던 새 도메인** 이므로 (근거: 부하계획
`569 행` 의 (B) bullet 문장) 도메인 **14 → 15**, 조회 route **30 → 31** 로 **둘 다 +1** 이다 —
slice 15·17·18·19·20·21 의 "도메인 불변 · route 만 +1" 셈법을 **복사하지 않고**, **slice 16 과 같은
셈법** 으로 적는다.

**계수 함정 ① — mock 잔존 30 은 이번에도 불변.** slice 22 파일명에도 `read` 가 있어 `*read*` glob 이
**50 → 51** 로 늘지만 실 DB read 도 **20 → 21** 로 함께 늘어 `51 − 21 = 30` 으로 **여전히 30** 이다.
세 문서에서 이 30 을 잘못 증감시키지 않는다.

**계수 함정 ② — 보수 분류 단락은 불변 (T-1542 의 "유보 해소" 문형 복사 금지).** T-1542 는
`import-detail-read` 가 바로 그 보수 분류 유보 1 건이어서 잔여를 1 → 0 으로 만들었지만,
`app-root-read` 는 애초에 유보가 아니라 **`app-root-read.perf-spec.ts` 실존 + 도메인 14 에
`AppController` 부재** 라는 **확정 근거** 로 (B) 였다. 따라서 보수 분류 단락 (`571~578 행` 부근) 은
**잔여 0 건 서술도 해소 이력 2 건도 그대로 보존** 하고 새 해소 사례를 추가하지 않는다 — T-1540 이
`part-detail-read` 에 대해 "불변" 으로 뒀던 것과 같은 판단이다.

**계수 함정 ③ — (B) 가 0 이 돼도 완료 선언 0 (본 task 최대 함정).** 조회 route 실측이
**31 = 인벤토리 열거 총계** 에 도달하지만 ① 인벤토리는 스스로 **완전 열거를 주장하지 않고**
(`587 행` 부근), ② (A) 부류 mock spec **30 개의 retire 판단은 미착수**, ③ **write / trigger route 는
애초에 목록 밖**, ④ REQ-047 실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정 **4 잔여 축
존속** 이다. "잔여 소진" · "성능 검증 완료" 로 읽히는 표현을 세 문서 어디에도 쓰지 않는다.

아울러 T-1543 이 주장한 **구조 축** 을 박제한다 — **실 부트스트랩 하 DB 미접촉 route 의 latency
floor** (`getRoot()` 이 상수 `APP_STATUS_MESSAGE` 를 동기 반환할 뿐이라 실 Prisma 연결이 살아 있어도
요청 경로가 DB 를 건드리지 않으므로, 같은 harness 조건에서의 **framework + HTTP 왕복만의 하한** 이자
slice 1~21 p95 를 읽을 때의 대조 기준선) + **guard layer 가 아예 없는 첫 실 DB slice**
(`JwtAuthGuard` · `RolesGuard` 미적용 → 쿠키 없이도 200 · 변조 쿠키도 200 · User tier 도 200). **새 축이
아닌 것** 도 병기한다 — collector / assert 배선 · `p95MaxMs: 0` 주입 fail 분기 · 인위 non-2xx errorRate
분기 · `buildBaselineReport` 관찰 전용은 slice 1~21 과 동일하다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 22** bullet 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1543-perf-realdb-slice22-app-root-read.md](T-1543-perf-realdb-slice22-app-root-read.md) —
  `## Why` 의 고유 축 2 종 · `## 결과 요약` 의 실측 결과 · 이월된 doc-sync 요구.
- [test/perf/app-root-read-realdb.perf-spec.ts](../../test/perf/app-root-read-realdb.perf-spec.ts) 의
  헤더 주석과 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **55 개**(그중 read 경로
  **50 개** … T-0830~T-1541)" · "실 DB round-trip 실측이 **slice 21 까지 도달**" · 말미 계수 나열
  "(perf-spec 55 / read 50 / 실 DB 21 / read 20 / 도메인 14 / 조회 route 30)" 가 slice 21 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "slice 21 까지 도달"(`135 행`), 재분류 이력 서술(`462~464 행` 부근), 셈법 서술
  (`476 행` 부근), 계산식 "read 50 개 − 실 DB read 20 개"(`485 행` 부근), 규모 민감도 잔여 목록
  (`495 행` · `514 행` 부근), 그리고 **잔여 read route 인벤토리**(`520 행` 이후) 의 머리말 실측 4 종 ·
  (A) 제목(`529 행`) 과 표 끝 행(`562 행`) · (B) 제목(`567 행`) 과 목록(`569 행`) · **보수 분류
  단락**(`571~578 행`) · (C) 절(`580 행` 이후, 검산식 `583 행`) · 자체 검산(`590 행` 부근) ·
  오독 차단 단락(`595 행` 부근).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. "한계 — 실 DB 축은
  부분 해소" 이하에 slice 1~21 서술과 endpoint 개수 · "나머지 read perf-spec 30 개" 계산식이 있다.
  **markdown 표 행** 이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1542 선례 —
  `||` 표기를 "OR 분기" 로 우회했다).
- [T-1540](T-1540-perf-realdb-slice20-doc-sync.md) — **보수 분류 단락 불변** 문형의 선례 (본 task 도
  같은 판단이다). [T-1542](T-1542-perf-realdb-slice21-doc-sync.md) — 직전 선례이자 본 task 의
  구조 · 문체 mirror. 두 task 의 **완료 선언 금지 · checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙을
  그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **56** · **51** · **22** ·
  **21** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). 본문에 쓰는 main SHA 는
  `56771076` (PR #1232) 이고, test 수는
  `grep -c "^\s*it(" test/perf/app-root-read-realdb.perf-spec.ts` 의 **실측값** 을 쓴다
  (T-1543 `## 결과 요약` 의 카테고리 셈이 아니라 `it(` 실측값이 정본 — T-1540 · T-1542 선례).
- [ ] **AC 2 — 계수 함정 ① 검산.** slice 22 파일명에도 `read` 가 **있어** `*read*` glob 개수가
  **50 → 51** 로 증가하지만, 실 DB read 파일도 **20 → 21** 로 함께 늘어 **"mock 잔존 read
  perf-spec 30 개" 는 여전히 불변** 이다 (51 − 21 = 30). 세 문서에서 이 30 을 잘못 증감시키지 않고,
  계산식 서술(`read 50 개 − 실 DB read 20 개`) 은 **`read 51 개 − 실 DB read 21 개`** 로 갱신하며
  결과가 같은 이유를 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 3 — 계수 함정 ② (도메인이 이번엔 는다) 반영.** slice 22 의 측정 대상 `AppController` 는
  실측 endpoint 도메인 14 개에 **없던 새 도메인** 이므로 도메인 **14 → 15**, 조회 route
  **30 → 31** 로 **둘 다 +1** 이다. slice 15·17·18·19·20·21 의 "도메인 불변 · route 만 +1" 서술을
  **복사하지 않고**, slice 22 가 **slice 16 과 같은 셈법** 임을 최소 1 곳에 1 구절로 남긴다.
- [ ] **AC 4 — 보수 분류 단락 불변 (본 task 고유 함정).** 부하계획의 **보수 분류 표기** 단락
  (`571~578 행` 부근) 은 **한 글자도 의미를 바꾸지 않는다** — ① "현재 보수 분류 잔여는 0 건" 유지,
  ② `import-detail-read` · `person-detail-read` **해소 이력 2 건 그대로 보존**, ③ `app-root-read` 를
  새 해소 사례로 **추가하지 않는다** (그 route 는 애초에 유보가 아니라 `app-root-read.perf-spec.ts`
  실존 + 도메인 14 에 `AppController` 부재라는 **확정 근거** 로 (B) 였다 — T-1542 의 "유보 해소" 문형
  복사 금지, T-1540 과 같은 "불변" 판단). "보수 분류는 근거가 생기면 풀린다" 방법론 문장도 유지.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `55` → **56**, read 경로 `50` → **51**, glob
  증가 서술을 **slice 22 기준(50 → 51)** 으로 정정, 범위 표기 `T-0830~T-1541` → **`T-0830~T-1543`**
  로 정정, ② "실 DB round-trip 실측이 **slice 21 까지 도달**" → **slice 22 까지 도달** 로 확장하고
  `app-root-read-realdb.perf-spec.ts` (T-1543, main `56771076`, `it(` 실측 수) 가 **`AppController`
  root read 1 route (`GET /api`) 를 mock override 0 인 실 부트스트랩으로 측정해 p95 < 3000ms 임을
  실측** 했다는 1 ~ 2 문장 추가 (**DB 미접촉 route 의 latency floor** = framework + HTTP 왕복만의
  하한이자 slice 1~21 대조 기준선 축 + **guard layer 가 아예 없는 첫 실 DB slice** 축 병기, 아울러
  **collector / assert 배선 · 주입 임계 fail 분기 · errorRate 분기 · baseline 관찰 전용은 slice 1~21 과
  동일해 새 축 아님** 1 구절), ③ 말미 계수 나열을 **perf-spec 56 / read 51 / 실 DB 22 / read 21 /
  도메인 15 / 조회 route 31** 로 갱신, ④ task 링크 목록에 T-1543 (및 doc-sync 계열 자리) 추가.
  **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 21 까지 도달" 서술(`135 행`)에 slice 22
  (T-1543, main `56771076`, `it(` 실측 수) 를 **1 ~ 2 문장으로 병기** 하고, 실측 범위 서술의
  **14 endpoint (조회 30 route)** 를 **15 endpoint (조회 31 route)** 로 갱신한다 (`476 행` 부근 셈법
  문장에는 slice 22 가 **slice 16 과 같은 셈법(도메인 + route 동시 +1)** 임을 이어 적는다).
  `**잔여**` 구절의 "나머지 read perf-spec 30 개는 service mock 잔존" 은 **30 개 불변** (AC 2) 이되
  계산식(`485 행` 부근)만 갱신한다. 재분류 이력 서술(`462~464 행` 부근) 에는 slice 22 가 **(B) → (A)
  네 번째 재분류** 이되 **보수 분류 유보 해소는 아님** 을 1 구절로 덧붙인다 (AC 4 와 정합).
  규모 민감도 잔여 목록(`495 행` · `514 행` 부근)에는 **slice 22 의 `GET /api`** 도 덧붙이되, 응답이
  **DB 를 접촉하지 않는 상수 문자열** 이라 규모 축 자체가 성립하지 않는다는 점을 1 구절로 병기한다 —
  규모 축이 해소된 것처럼 적지 않는다. **"본 item 은 미완" 결론은 그대로 유지** —
  `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나 완화하지 않는다.
- [ ] **AC 7 — 인벤토리 (A)/(B) 재분류 (본 task 고유 ①).** 부하계획 `§ 5` item 5 의 **잔여 read route
  인벤토리**(`520 행` 이후) 를 다음 5 지점 모두 갱신한다 — ① 머리말의 "slice 21 시점 확인분, T-1536
  작성 → T-1542 갱신" 을 **"slice 22 시점 확인분, T-1536 작성 → T-1544 갱신"** 취지로 정정하고 편집
  전 실측 개수 4 종 (`55`·`50`·`21`·`20`) 을 **`56`·`51`·`22`·`21`** 로 갱신, ② (A) 제목(`529 행`)을
  **29 개 → 30 개** 로 고치고 표 끝(`562 행` 뒤)에
  `| app-root-read | GET /api | slice 22 (app-root-read-realdb) |` 행 1 개 추가, ③ (B) 제목(`567 행`)을
  **1 개 → 0 개** 로 고치고 `app-root-read` bullet(`569 행`) **삭제** — 목록이 비므로 "현 시점 (B)
  후보 0 건" 취지의 1 문장으로 대체하되 **"잔여 소진 · 완료" 로 읽히지 않게** 쓴다 (AC 9),
  ④ 보수 분류 단락은 AC 4 대로 **불변**, ⑤ **자체 검산**(`590 행` 부근) 을
  **`A + B = 30 + 0 = 30`** ↔ **`read 51 − 실 DB read 21 = 30`** 으로 갱신한다. 두 셈이 어긋나면
  문서가 아니라 분류를 고친다.
- [ ] **AC 8 — 인벤토리 (C) 절 검산식 갱신 (0 건 불변).** (C) 절(`580~583 행` 부근) 의 등식
  **`실측 30 + (B) 1 = 31`** 을 **`실측 31 + (B) 0 = 31`** 로 갱신한다 — 조회 route 총 **31 은 불변**
  이고 **(C) 는 여전히 0 건** 이다. slice 18 이 (C) 였다가 해소된 선례 서술은 그대로 보존하고,
  "`AppController` 의 root read 는 (C) 후보로 보였으나 `app-root-read.perf-spec.ts` 가 실존해 (B) 로
  분류했다"(`586~587 행` 부근) 는 문장은 **slice 22 로 (A) 로 옮겨갔다** 는 취지로 최소 수정하되
  분류 이력 자체를 지우지 않는다. "본 절은 완전 열거를 주장하지 않는다 — 현 시점 확인분" 유보 문장도
  삭제하지 않는다.
- [ ] **AC 9 — 오독 차단 단락 갱신 + 완료 선언 0 (계수 함정 ③).** 오독 차단 단락(`595 행` 부근) 의
  **`(B) + (C) = 1 + 0 = 1 route`** 를 **`0 + 0 = 0 route`** 로 갱신하되, 그 단락의 유보 문장 —
  (A) 부류 mock spec **30 개 retire 판단 미착수** · **write / trigger route 는 목록 밖** · **30 은
  잔여의 상한도 하한도 아님** — 을 그대로 보존하고, 여기에 **"(B) 0 은 인벤토리가 열거한 범위가
  소진됐다는 뜻일 뿐 조회 성능 검증 완료가 아니다"** 취지의 1 ~ 2 문장을 추가한다 (근거 4 종:
  완전 열거 미주장 · (A) 30 retire 미착수 · write / trigger 목록 밖 · REQ-047 실 scale 부하 ·
  baseline 확정 · 임계 fix · web 렌더 4 잔여 축 존속). 세 문서 어디에도 **"잔여 소진" · "전량 실측
  달성" · "성능 검증 완료"** 로 읽히는 표현을 쓰지 않는다.
- [ ] **AC 10 — REQ-048 재판정 갱신.** `docs/requirements.md` REQ-048 행(`67 행`)의 "한계 — 실 DB 축은
  부분 해소" 문장에 slice 22 를 반영한다 — 파일명 · task · main SHA · test 수(`it(` 실측) · **질적
  차이 (DB 미접촉 route 의 floor · guard 0 route)** · 조회 1 route · "endpoint 수 **14 → 15
  (조회 31 route)**" · 계산식 `read 51 개 − 실 DB read 21 개` (차이 30 불변).
  **status 토큰 `IN_PROGRESS` 는 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" ·
  "baseline 확정 · 임계 fix 미완" 서술도 불변.
- [ ] **AC 11 — 표 구조 보존.** REQ-048 은 markdown 표 행이므로 새로 넣는 문장에 **파이프 `|` 문자를
  쓰지 않는다** (`||` 같은 코드 표기가 필요하면 "OR" 로 풀어 쓴다 — T-1515 ~ T-1542 선례). 편집 후
  `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와 파이프 개수 **8 불변** 을 확인한다. 부하계획
  (A) 표에 새로 넣는 행은 **정확히 3 셀**(mock spec / route / 실측 slice) 이어야 하며 편집 후
  기존 29 행 + 신규 1 행 = **30 행** 임을 확인한다.
- [ ] **AC 12 — `AppController` 재판정 0.** 세 문서 어디에도 slice 22 가 관측한 **health endpoint 에
  guard 가 없다** · **`POST /api` 가 405 가 아니라 404** · **상수 반환** 을 **결함 · 보안 문제 ·
  수정 필요** 로 읽히게 적지 않는다 — 본 doc-sync 는 현재 동작을 **판단 없이 인용만** 하며 guard 부착
  여부는 별도 판단이다. 관련 REQ 행(REQ-057 등 보안 REQ) 은 **수정하지 않는다**.
- [ ] **AC 13 — REQ-047 오독 차단.** 세 문서 어디에도 slice 22 가 **REQ-047 실 scale 부하 (100~200명 /
  50~100 repo / ~1000 confluence page / 1h)** 충족으로 읽히는 표현을 쓰지 않는다. 표본은 상대 비교용
  소규모이며 **본 route 는 DB 를 접촉조차 하지 않아 부하 축과 무관** 함을 오독 여지 없이 서술하고,
  REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 14 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) 규모 축은 `:id/persons` (group) 한 route 한정 ·
  다른 endpoint 의 규모 민감도 미측정, (c) baseline 파일 확정 · 임계 fix 미완, (d) 시각화(web) 렌더
  측정 축 부재 + REQ-047 실 scale 부하 미검증. 하나라도 삭제됐으면 되돌린다. 아울러 PLAN `140 행`
  성능 검증 checkbox 가 `[ ]` 그대로 · REQ-048 status 가 `IN_PROGRESS` 그대로 · 부하계획 `§ 5` item 5
  가 여전히 미완으로 읽히는지 세 지점을 각각 확인한다.
- [ ] **AC 15 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**. 마지막에
  `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다 (코드 변경 0 이라 test 는 불요 —
  §3.2 R-110 의 direct doc-only 면제).

## Out of Scope

- **코드 · spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1543 이 이미 slice 22
  항목과 잔여 계수를 박제했다 — 인용만).
- **perf slice 23 착수 · 새 측정 축 발굴** — 인벤토리 (B) 가 0 이 된 뒤 무엇을 다음 slice 로 삼을지
  (write / trigger route 인벤토리화 · (A) retire · baseline 확정 · web 렌더) 는 **planner 의 다음 호출
  몫** 이다. 본 task 는 후속 방향을 문서에 결론으로 적지 않는다 (Follow-ups 에만).
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — 특히 이번에 (A) 로 옮겨가는
  [`app-root-read.perf-spec.ts`](../../test/perf/app-root-read.perf-spec.ts) 를 지울지 남길지는
  T-1536 이 명시적으로 유보한 별도 판단이다 (`test/` 변경이라 `pr`). Follow-ups 에만 적는다.
- **`app-root-measure-confirm.perf-spec.ts` 의 timing-fragile 이력 (T-0877 · T-0880 · T-0881)
  재판정** — `GET /api` 관련 서술을 본 doc-sync 에서 확장하지 않는다.
- **`AppController` 의 guard 미적용 · 상수 반환 · 404 수렴에 대한 재판정** — 현재 동작을 **판단 없이
  인용만** 하고 REQ 재판정을 하지 않는다 (AC 12).
- **보수 분류 단락에 새 해소 사례 추가** (AC 4) — `app-root-read` 는 애초에 유보가 아니었다.
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** — 잔여 축
  (실 scale 부하 · baseline 확정 · 임계 fix · web 렌더 측정) 이 살아 있으므로 금지 (AC 9 · AC 14).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 (S1 배치 부하) 행 수정** (AC 13) · **REQ-057 / REQ-026 / REQ-045 행 재판정**.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다 (확장 여부는 별도 task 판단).
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 15).
- **ADR status flip (ADR-0054 PROPOSED 포함) · 새 dependency 도입 · `docs/architecture/*` 편집** —
  §3.1 상 `pr` 이거나 §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

(작성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
