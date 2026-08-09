---
id: T-1546
title: 실 DB perf slice 23(T-1545) GET /api/persons 규모 민감도 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 130
estimatedFiles: 3
created: 2026-08-09
createdAt: 2026-08-09T19:38:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1545]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1545 Follow-ups 가 이월한 direct doc-sync — PLAN 142 행 slice 22 → 23 · perf-spec 56 → 57 · 실 DB 22 → 23, 규모 축 1 → 2 route, 나머지 계수·인벤토리 전부 불변 (완료 선언 0)"
---

# T-1546 — 실 DB perf slice 23 doc-sync (`GET /api/persons` 규모 민감도)

## Why

[T-1545](T-1545-perf-realdb-slice23-person-list-scale.md) 가 PR
[#1233](https://github.com/myungjoo/Assessment-Agent/pull/1233) round 1 로 머지돼 (main `68d319e8`)
`test/perf/person-list-scale-realdb.perf-spec.ts` 가 `GET /api/persons` 를 **소규모 20 row vs
대규모 200 row 두 표본** 으로 재고, 추가로 **active 120 / inactive 80 의 필터 선택도** 축까지
실 부트스트랩(mock override 0) + 실 Prisma 로 측정했다. 그런데 T-1545 의 `## Follow-ups` 가
[CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3 (direct · pr mixed 금지) 에 따라 PLAN · 부하계획 ·
REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다. 그 결과 3 문서가 아직 **slice 22
시점 전제** 이고, [PLAN.md](../PLAN.md) `142 행` 의 "실 DB round-trip 실측이 **slice 22 까지 도달**"
과 말미 계수 나열은 stale 하다. [test/perf/README.md](../../test/perf/README.md) 는 T-1545 가 이미
slice 23 항목과 잔여 계수를 박제했으므로 본 task 는 그 정본을 **인용만** 한다.
본 task 는 [T-1542](T-1542-perf-realdb-slice21-doc-sync.md) ·
[T-1544](T-1544-perf-realdb-slice22-doc-sync.md) 가 slice 21~22 에 대해 수행한 doc-sync 의
**slice 23 판** 이다.

**본 doc-sync 고유 대상 ① — 인벤토리 재분류가 0 인 첫 slice.** slice 1~22 는 모두 **잔여 read
route 인벤토리** 의 (B) 또는 (C) 를 (A) 로 옮기는 cutover 였다. slice 23 은 다르다 — 대상
`GET /api/persons` 는 **slice 1 (T-1500) 이 이미 실측한 route** 라서 (A) **30 불변** · (B) **0 불변**
· (C) **0 불변**, 도메인 **15 불변**, 조회 route **31 불변** 이다. (A) 표에 행을 추가하지 않고,
"다섯 번째 재분류" 같은 문형을 **쓰지 않는다** (T-1544 의 재분류 문형 복사 금지).

**본 doc-sync 고유 대상 ② — 규모 축이 1 route → 2 route 로 넓어진다.** 부하계획 `§ 5` item 5 의
규모 민감도 단락(`537 행` 부근)은 지금 "**규모 축 실측은 `:id/persons` 한 route 에 한해 도달**"
이라고 적는다. slice 3 (T-1504, `GET /api/groups/:id/persons`, membership 5 vs 60) 하나뿐이었기
때문이다. slice 23 이 **`GET /api/persons` 의 총 row 수 20 vs 200 + 필터 선택도** 를 더했으므로
이 서술을 **2 route 도달** 로 갱신한다. 다만 **규모 축이 해소된 것은 아니다** — 나머지 endpoint 의
규모 민감도는 여전히 미측정이고 표본은 상대 비교용 소규모다.

**계수 함정 ① — `read` glob 51 도, mock 잔존 30 도 이번엔 둘 다 불변.** slice 23 의 파일명
`person-list-scale-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 에 이은 두 번째 사례).
따라서 `*read*` glob 은 **51 불변**, `*read*realdb*` 도 **21 불변** 이라 계산식
`read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 반면 `*.perf-spec.ts` 는
**56 → 57**, `*realdb*` 는 **22 → 23** 으로 는다. PLAN `142 행` 의 "slice 22 파일명에도 `read` 가
있어 glob 개수가 50 → 51 로 증가" 서술은 **slice 23 기준(파일명에 `read` 없음 → 51 불변)** 으로
정정해야 한다 — T-1544 의 "피감수와 감수가 함께 늘어 결과가 같다" 문형을 **복사하면 틀린다**
(이번엔 피감수·감수 **둘 다 안 는다**).

**계수 함정 ② — 완료 선언 0 (본 task 최대 함정).** 인벤토리 (B) 가 이미 0 인 상태에서 규모 축까지
넓어져 "잔여가 없다" 로 읽힐 위험이 크다. 그러나 잔여 4 축 — (a) (A) 부류 mock spec 30 개 retire
판단 미착수, (b) 다른 endpoint 규모 민감도 미측정, (c) baseline 확정 · 임계 fix 미완, (d) 시각화
(web) 렌더 측정 부재 + REQ-047 실 scale 부하 미검증 — 이 그대로다. PLAN `140 행` checkbox `[ ]` ·
REQ-048 `IN_PROGRESS` · 부하계획 item 5 "본 item 은 미완" 을 **전부 유지** 한다.

아울러 T-1545 가 주장한 **구조 축** 을 박제한다 — **같은 route 의 총 row 수 규모 민감도**
(slice 3 의 규모 축은 부모 1 건의 자식 membership fan-out 이었으나 slice 23 은 **목록 route 자체의
테이블 총 row 수** 를 키운 첫 사례) + **필터 선택도 축** (`active` 조건으로 걸러지는 비율이 달라질 때의
p95). **새 축이 아닌 것** 도 병기한다 — collector / assert 배선 · 주입 임계 fail 분기 · errorRate 분기 ·
`buildBaselineReport` 관찰 전용은 slice 1~22 와 동일하고, 두 표본의 **대소 관계는 wall-clock
비결정성 때문에 assert 하지 않는 관찰 기록** 이라는 점도 slice 3 과 같다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 절의
  **slice 23** bullet 과 그 뒤 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을
  **수정하지 않고 인용만** 한다.
- [docs/tasks/T-1545-perf-realdb-slice23-person-list-scale.md](T-1545-perf-realdb-slice23-person-list-scale.md)
  — `## Why` 의 고유 축 2 종(총 row 수 규모 · 필터 선택도) 과 이월된 doc-sync 요구.
- [test/perf/person-list-scale-realdb.perf-spec.ts](../../test/perf/person-list-scale-realdb.perf-spec.ts)
  의 헤더 주석과 `it(` 목록 — 문서에 적을 test 수 · 표본 규모의 **실측 출처**. **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **56 개**(그중 read 경로
  **51 개** — slice 22 파일명에도 `read` 가 있어 glob 개수가 50 → 51 로 증가, T-0830~T-1543)" ·
  "실 DB round-trip 실측이 **slice 22 까지 도달**" · 말미 계수 나열이 slice 22 시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "slice 22 까지 도달"(`135 행`), 재분류 이력 서술(`481~484 행` 부근), 셈법 서술
  (`486 행` · `497 행` 부근), 계산식 "read 51 개 − 실 DB read 21 개"(`505 행` 부근), 규모 민감도
  잔여 목록(`515 행` · `530~537 행` 부근), **잔여 read route 인벤토리** 머리말(`542 행`) ·
  (A) 제목(`551 행`) 과 표(`585 행` 부근) · (B) 절(`590~595 행`) · 보수 분류 단락(`598~605 행`) ·
  (C) 절(`607~614 행`) · 자체 검산(`618 행` 부근) · 오독 차단 단락(`623~630 행`).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. **markdown 표 행**
  이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1544 선례 — `||` 표기를
  "OR 분기" 로 우회했다).
- [T-1544](T-1544-perf-realdb-slice22-doc-sync.md) — 직전 선례이자 본 task 의 구조 · 문체 mirror.
  단 **재분류 문형과 glob 증가 문형은 복사 금지** (본 task 는 둘 다 "불변" 이다).
  **완료 선언 금지 · checkbox `[ ]` 유지 · `IN_PROGRESS` 유지** 원칙은 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **57** · **51** · **23** ·
  **21** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). main SHA 는 `68d319e8`
  (PR #1233) 이고, test 수는
  `grep -c "^\s*it(" test/perf/person-list-scale-realdb.perf-spec.ts` 의 **실측값** 을 쓴다.
- [ ] **AC 2 — 계수 함정 ① 검산 (glob 두 개 다 불변).** slice 23 파일명에 `read` 가 **없어**
  `*read*` 는 **51 불변** · `*read*realdb*` 는 **21 불변** 이고, 따라서 계산식
  `read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 세 문서에서 이 계산식과 30 을
  건드리지 않되, **왜 이번엔 피감수도 감수도 안 느는지** (파일명에 `read` 부재 — slice 3 에 이은
  두 번째 사례) 를 최소 1 곳에 1 구절로 남긴다. T-1544 의 "둘 다 늘어 결과가 같다" 문형은 **복사
  금지**.
- [ ] **AC 3 — 계수 함정 ② (재분류 0) 반영.** slice 23 의 대상 `GET /api/persons` 는 **slice 1 이 이미
  실측한 route** 이므로 도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30 불변** ·
  (B) **0 불변** · (C) **0 불변** · 자체 검산 `A + B = 30 + 0 = 30` **불변** · (C) 검산식
  `실측 31 + (B) 0 = 31` **불변** 이다. **(A) 표에 행을 추가하지 않고** "다섯 번째 재분류" 류
  문형을 쓰지 않으며, slice 23 이 **재분류 0 인 첫 slice** 임을 재분류 이력 서술(`481~484 행` 부근)
  에 1 구절로 덧붙인다.
- [ ] **AC 4 — 규모 축 1 → 2 route 갱신 (본 task 고유).** 부하계획 `§ 5` item 5 의 규모 민감도 단락
  (`530~537 행` 부근) 말미 "**규모 축 실측은 `:id/persons` 한 route 에 한해 도달**" 을
  **`:id/persons` 와 `GET /api/persons` 두 route** 로 갱신하고, slice 23 이 **목록 route 자체의
  테이블 총 row 수(20 vs 200)** 를 키운 첫 사례이며 **필터 선택도(active 120 / inactive 80)** 축을
  추가했음을 1 ~ 2 문장으로 적는다. 동시에 **규모 축이 해소된 것이 아님** 을 같은 자리에 명시한다
  — 나머지 endpoint 미측정 · 표본은 상대 비교용 소규모 · 두 표본의 대소 관계는 **wall-clock
  비결정성 때문에 미단언** (slice 3 과 동일). `515 행` 부근 목록에도 slice 23 을 덧붙인다.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `56` → **57**, read 경로는 **51 그대로 두되**
  괄호 안 설명을 **slice 23 기준(파일명에 `read` 가 없어 glob 51 불변)** 으로 정정, 범위 표기
  `T-0830~T-1543` → **`T-0830~T-1545`**, ② "실 DB round-trip 실측이 **slice 22 까지 도달**" →
  **slice 23 까지 도달** 로 확장하고 `person-list-scale-realdb.perf-spec.ts` (T-1545, main
  `68d319e8`, `it(` 실측 수) 가 **`GET /api/persons` 를 20 row vs 200 row 두 표본 + active 120 /
  inactive 80 선택도로 재어 p95 < 3000ms 를 유지함을 실측** 했다는 1 ~ 2 문장 추가 (**같은 route 의
  총 row 수 규모 축** · **필터 선택도 축** 병기 + **대소 관계 미단언 관찰 기록** 1 구절 +
  **collector / assert 배선 · 주입 임계 fail 분기 · errorRate 분기 · baseline 관찰 전용은 slice
  1~22 와 동일해 새 축 아님** 1 구절), ③ 말미 계수 나열을 **perf-spec 57 / read 51 / 실 DB 23 /
  read 21 / 도메인 15 / 조회 route 31** 로 갱신, ④ task 링크 목록에 T-1545 추가.
  **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 22 까지 도달" 서술(`135 행`)에 slice 23
  (T-1545, main `68d319e8`, `it(` 실측 수) 를 **1 ~ 2 문장으로 병기** 하되 실측 범위
  **15 endpoint (조회 31 route)** 는 **불변** 임을 명시한다. 셈법 서술(`486 행` · `497 행` 부근)에는
  slice 23 이 **도메인도 route 도 늘리지 않는 첫 slice** (같은 route 의 다른 축) 임을 1 구절로
  이어 적는다. `**잔여**` 의 "나머지 read perf-spec 30 개는 service mock 잔존" 과 계산식
  (`505 행` 부근) 은 **문구 그대로 두고** AC 2 의 이유 1 구절만 덧붙인다. **"본 item 은 미완" 결론
  유지** — `buildBaselineReport` 관찰 전용 · baseline 미확정 · 임계 fix 미착수 서술을 삭제하거나
  완화하지 않는다.
- [ ] **AC 7 — 인벤토리 머리말만 갱신, 표·분류는 전부 불변.** `542 행` 의
  "(slice 22 시점 확인분, T-1536 작성 → T-1544 갱신)" 을
  **"(slice 23 시점 확인분, T-1536 작성 → T-1546 갱신)"** 으로 고치고 머리말의 편집 전 실측 개수
  4 종 (`56`·`51`·`22`·`21`) 을 **`57`·`51`·`23`·`21`** 로 갱신한다. 그 외 (A) 제목(`551 행`,
  30 개) · (A) 표 30 행 · (B) 절(`590~595 행`, 0 개) · **보수 분류 단락(`598~605 행`)** ·
  (C) 절(`607~614 행`, 0 건 + 검산식) · 자체 검산(`618 행` 부근) 은 **한 글자도 의미를 바꾸지
  않는다** (AC 3).
- [ ] **AC 8 — 오독 차단 단락 보존 + 완료 선언 0 (계수 함정 ②).** 오독 차단 단락(`623~630 행`) 의
  `(B) + (C) = 0 + 0 = 0 route` 와 그 유보 문장 — (A) 부류 mock spec **30 개 retire 판단 미착수** ·
  **write / trigger route 는 목록 밖** · **30 은 잔여의 상한도 하한도 아님** · **(B) 0 은 조회 성능
  검증 완료가 아님** — 을 **전부 보존** 하고, 규모 축이 2 route 로 넓어진 것 역시 **잔여 소진이
  아님** 을 1 문장으로 덧붙인다. 세 문서 어디에도 **"잔여 소진" · "전량 실측 달성" · "규모 축
  해소" · "성능 검증 완료"** 로 읽히는 표현을 쓰지 않는다.
- [ ] **AC 9 — REQ-048 재판정 갱신 + 표 구조 보존.** `docs/requirements.md` REQ-048 행(`67 행`)의
  "한계 — 실 DB 축은 부분 해소" 문장에 slice 23 을 반영한다 — 파일명 · task · main SHA ·
  test 수(`it(` 실측) · **질적 차이(같은 route 의 총 row 수 규모 + 필터 선택도)** · **endpoint 수
  15 · 조회 31 route 불변** · 계산식 `read 51 개 − 실 DB read 21 개` (차이 30, **식 불변**).
  **status 토큰 `IN_PROGRESS` 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" ·
  "baseline 확정 · 임계 fix 미완" 서술도 불변. 새로 넣는 문장에 **파이프 `|` 문자를 쓰지 않고**
  (필요하면 "OR" 로 풀어 쓴다), 편집 후 `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와
  파이프 개수 **8 불변** 을 확인한다.
- [ ] **AC 10 — REQ-047 오독 차단.** 세 문서 어디에도 slice 23 의 **200 row 표본** 이 REQ-047 실
  scale 부하 (100~200명 / 50~100 repo / ~1000 confluence page / 1h) 충족으로 읽히는 표현을 쓰지
  않는다 — 표본은 **상대 비교용 소규모** 이고 person row 수만 키웠을 뿐 repo · confluence · 배치
  시간 축은 부재임을 오독 여지 없이 서술하며, REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 11 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) **규모 축은 2 route 한정 · 다른 endpoint 미측정**,
  (c) baseline 파일 확정 · 임계 fix 미완, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale
  부하 미검증. 하나라도 삭제됐으면 되돌린다. 아울러 PLAN `140 행` 성능 검증 checkbox 가 `[ ]`
  그대로 · REQ-048 status 가 `IN_PROGRESS` 그대로 · 부하계획 `§ 5` item 5 가 여전히 미완으로
  읽히는지 세 지점을 각각 확인한다.
- [ ] **AC 12 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**.
  마지막에 `git diff --stat` 이 **3 파일(+ 본 task 파일) / ≤ 300 LOC** 임을 확인한다 (코드 변경 0
  이라 test 는 불요 — §3.2 R-110 의 direct doc-only 면제).

## Out of Scope

- **코드 · spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1545 가 이미 slice 23
  항목과 잔여 계수를 박제했다 — 인용만).
- **perf slice 24 착수 · 다음 축 선정** — (A) 부류 mock spec 30 개 retire · baseline 확정 · 임계
  fix · web 렌더 측정 · 다른 endpoint 규모 민감도 중 무엇을 다음으로 삼을지는 **planner 의 다음
  호출 몫** 이다. 본 task 는 후속 방향을 문서에 결론으로 적지 않는다 (Follow-ups 에만).
- **인벤토리 (A) 표 · (B) · (C) · 보수 분류 단락 · 자체 검산 수정** (AC 3 · AC 7) — slice 23 은
  재분류 0 이다.
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — 특히
  [`person-list-read.perf-spec.ts`](../../test/perf/person-list-read.perf-spec.ts) 계열을 지울지
  남길지는 T-1536 이 명시 유보한 별도 판단이고 `test/` 변경이라 `pr` 이다. Follow-ups 에만 적는다.
- **`PersonController` · `findAll` 의 쿼리 성능 재판정 · 인덱스 추가 제안** — slice 23 이 관측한
  수치를 **판단 없이 인용만** 하고 개선 제안을 문서에 적지 않는다 (`prisma/schema.prisma` 변경은
  §5 DB schema BLOCKED 게이트 대상이기도 하다).
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** (AC 8 · AC 11).
- **임계값 · baseline 정책 변경** — `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **REQ-047 행 수정** (AC 10) · **REQ-057 / REQ-026 / REQ-045 행 재판정**.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 12).
- **ADR status flip · 새 dependency 도입 · `docs/architecture/*` 편집** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

- (작성 시점 없음 — sub-agent 가 발견한 관련 작업을 여기에 추가한다.)
