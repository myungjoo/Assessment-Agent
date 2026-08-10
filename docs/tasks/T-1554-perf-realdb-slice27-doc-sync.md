---
id: T-1554
title: 실 DB perf slice 27(T-1553) GET /api/contributions measure→confirm baseline 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: DONE
completedAt: 2026-08-10T12:45:00Z
commitSha: 5a6af52d
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-08-10
createdAt: 2026-08-10T11:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1553]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1553 이 §3.1 rule 3 로 이월한 direct doc-sync — perf-spec 60 → 61 · 실 DB 26 → 27, read glob 51/21 불변(여섯 번째) · 재분류 0 은 5 연속 (완료 선언 0)"
---

# T-1554 — 실 DB perf slice 27 doc-sync (`GET /api/contributions` measure→confirm baseline loop)

## Why

[T-1553](T-1553-perf-realdb-slice27-contribution-measure-confirm.md) 이 PR
[#1237](https://github.com/myungjoo/Assessment-Agent/pull/1237) 로 머지돼 (main `856687bf`)
`test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 가 `measureAndConfirmBaseline` 의
measure → confirm-or-compare top loop 를 **세 번째 route** 인
`GET /api/contributions?assessmentId=` 실 Postgres round-trip 위에 태웠다. 그런데 T-1553 의
Out of Scope 가 [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3 (direct · pr mixed 금지) 에 따라
PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다. 그 결과 3 문서가
아직 **slice 26 시점 전제** 이고, [PLAN.md](../PLAN.md) `142 행` 의 "`*.perf-spec.ts` **60 개**" ·
"실 DB round-trip 실측이 **slice 26 까지 도달**" · 범위 표기 `T-0830~T-1551` · 말미 계수 나열이
stale 하며, 부하계획 `135 행` 머리말과 `652 행` 인벤토리 머리말도 slice 26 시점이다.
[test/perf/README.md](../../test/perf/README.md) 는 T-1553 이 이미 slice 27 bullet(`1053 행` 부근)과
잔여 계수(`1074 행` 부근)를 박제했으므로 본 task 는 그 정본을 **인용만** 한다.
본 task 는 [T-1550](T-1550-perf-realdb-slice25-doc-sync.md) ·
[T-1552](T-1552-perf-realdb-slice26-doc-sync.md) 가 slice 25~26 에 대해 수행한 doc-sync 의
**slice 27 판** 이다.

**본 doc-sync 고유 대상 ① — baseline 확정 축의 세 번째 route 다 (첫도 두 번째도 아니다).**
slice 25 가 `GET /api/summaries` 로 (c) 축에 **처음 진입**, slice 26 이 `GET /api/assessments` 로
**두 번째 route** 를 더했고, slice 27 은 **세 번째 route** 다. 3 문서 중 최소 각 1 곳에 "첫 진입" ·
"두 번째 route" 가 아니라 **세 번째 route** 라고 적는다 — T-1552 의 "두 번째 route" 문형을 그대로
복사하면 틀린다.

**본 doc-sync 고유 대상 ② — `Person → Assessment → Contribution` 3-level FK chain 의 첫 실 DB
baseline 배선이다.** slice 25 · 26 대상은 person 기준 1~2 단계 조회였으나 slice 27 대상은 **부모
id(`assessmentId`) 로 자식 컬렉션을 긁는 3-level FK chain** 이고, 그 구조가 established · compared
**양 국면 모두** 에서 실측됐다 (부모 A 5 건 · 부모 B 3 건 두 표본으로 부모 필터 분해력을 입증).
같은 route 를 관찰 전용으로 잰 slice 5(`contribution-read-realdb`) 와의 대조 관계도 함께 적는다.

**계수 함정 ① — `read` glob 두 개 다 이번에도 불변 (여섯 번째 사례).** slice 27 파일명
`contribution-measure-confirm-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 · 23 · 24 · 25 ·
26 에 이은 **여섯 번째**). 따라서 `*read*` 는 **51 불변** · `*read*realdb*` 는 **21 불변** 이고
계산식 `read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 늘어나는 것은
`*.perf-spec.ts` **60 → 61** 과 `*realdb*` **26 → 27** 뿐이다. T-1552 가 쓴 "**다섯 번째** 사례"
문형을 **복사하면 틀린다**.

**계수 함정 ② — "4 연속" 문형 복사 금지 (재분류 0 이 5 연속).** T-1546 이 slice 23 을 "첫",
T-1548 이 slice 24 를 "2 연속", T-1550 이 slice 25 를 "3 연속", T-1552 가 slice 26 을 "4 연속" 으로
박제했다. slice 27 은 **5 연속** 이다. 대상 `GET /api/contributions?assessmentId=` 는 **slice 5 가
이미 실측한 route** (부하계획 `672 행` 인벤토리 (A) 행) 라 도메인 **15 불변** · 조회 route **31
불변** · 인벤토리 (A) **30 불변** · (B) **0 불변** · (C) **0 불변** 이고, (A) 표에 행을 추가하지
않는다.

**계수 함정 ③ — 규모 축은 3 route 그대로 (늘리면 틀린다).** slice 27 은 **규모 축 slice 가
아니다** — 부모 A 5 건 vs 부모 B 3 건은 규모 비교가 아니라 **부모 필터 분해력** 관측이다. 부하계획
`641~649 행` 규모 축 단락과 `737~741 행` 부근 오독 차단 단락의 **3 route 서술을 4 로 올리지
않는다**. "자식 5 건 vs 3 건" 이 규모 민감도 표본으로 읽히지 않게 특히 조심한다.

**계수 함정 ④ — 완료 선언 0 (본 task 최대 함정).** baseline 축이 route **3 개** 로 늘어난 사실이
"(c) 축 해소" 로 읽힐 위험이 크다. 그러나 slice 27 의 baseline 도 **임시 디렉토리 1 회성** 이고
**repo 체크인 기준 baseline(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 전부 미착수** 다. 잔여
4 축 — (a) (A) 부류 mock spec 30 개 retire 판단, (b) 다른 endpoint 규모 민감도, (c) baseline 확정 ·
임계 fix, (d) web 렌더 측정 + REQ-047 실 scale 부하 — 이 **넷 다 그대로** 이며 PLAN `140 행`
checkbox `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 item 5 "본 item 은 미완"(`579 행`) 을 **전부
유지** 한다.

**새 축이 아닌 것** 도 병기한다 — collector / assert 배선 · 주입 임계 fail 분기 · errorRate 분기 ·
401 guard 생존 확인 · **두 run 의 대소 관계와 `comparison.regressed` 를 assert 하지 않는 관찰 기록**
원칙은 slice 1~26 과 동일해 새 축이 아니다.

## Required Reading

- [test/perf/README.md](../../test/perf/README.md) `1053 행` 부근의 **slice 27** bullet 과
  `1074 행` 부터의 **잔여** bullet — 갱신의 **정본 근거**. 본 task 는 이 파일을 **수정하지 않고
  인용만** 한다.
- [docs/tasks/T-1553-perf-realdb-slice27-contribution-measure-confirm.md](T-1553-perf-realdb-slice27-contribution-measure-confirm.md)
  — `## Why` 의 고유 축(세 번째 route · 3-level FK chain), 계수 함정, 실측 결과 요약
  (PR #1237 · main `856687bf` · 2 파일 `+300/-9`), Out of Scope 가 이월한 doc-sync 요구.
- [test/perf/contribution-measure-confirm-realdb.perf-spec.ts](../../test/perf/contribution-measure-confirm-realdb.perf-spec.ts)
  의 헤더 주석과 `it(` 목록 — 문서에 적을 test 수의 **실측 출처** (편집 전 실측 **11**).
  **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `142 행` — 갱신 대상 1. 현재 "`*.perf-spec.ts` **60 개**(그중 read 경로
  **51 개** — slice 26 파일명 `assessment-measure-confirm-realdb.perf-spec.ts` 에도 `read` 가 없어 …,
  T-0830~T-1551)" · "실 DB round-trip 실측이 **slice 26 까지 도달**" · 말미 계수 나열이 slice 26
  시점 값이다.
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. "slice 26 까지 도달"(`135 행`), 재분류 이력 · 셈법 서술(`534 행` · `550~552 행` ·
  `574~580 행` 부근), glob 셈법(`593~594 행` 부근), 규모 민감도 단락(`635 행` · `641~649 행` 부근),
  **잔여 read route 인벤토리** 머리말(`652 행`), (A) 표의 contribution 행(`672~673 행`), 오독 차단
  단락(`737~745 행` 부근), 미완 결론(`579 행`).
- [docs/requirements.md](../requirements.md) REQ-048 행 (`67 행`) — 갱신 대상 3. **markdown 표 행**
  이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (T-1515 ~ T-1552 선례 — 필요 시 "OR" 로 풀어
  썼다). 현재 파이프 **8 개** · **1 행** 이다.
- [T-1552](T-1552-perf-realdb-slice26-doc-sync.md) — 직전 선례이자 본 task 의 구조 · 문체 mirror.
  단 **"다섯 번째 사례" · "4 연속" · "두 번째 route" 문형은 복사 금지** (본 task 는 각각
  여섯 번째 · 5 연속 · **세 번째 route** 다). **완료 선언 금지 · checkbox `[ ]` 유지 ·
  `IN_PROGRESS` 유지** 원칙은 그대로 승계한다.

## Acceptance Criteria

- [ ] **AC 1 — 수치 실측 확인 (편집 전).** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 을 실행해 각각 **61** · **51** · **27** ·
  **21** 임을 확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). main SHA 는 `856687bf`
  (PR #1237) 이고, test 수는
  `grep -c "^\s*it(" test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 의 **실측값** 을 쓴다.
- [ ] **AC 2 — 계수 함정 ① 검산 (glob 두 개 다 불변, 여섯 번째 사례).** slice 27 파일명에 `read` 가
  **없어** `*read*` 는 **51 불변** · `*read*realdb*` 는 **21 불변** 이고 계산식
  `read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 세 문서에서 이 계산식과 30 을
  건드리지 않되, **파일명에 `read` 가 없는 여섯 번째 사례**(slice 3 · 23 · 24 · 25 · 26 에 이어) 임을
  부하계획 glob 셈법 서술(`593~594 행` 부근)에 1 구절로 덧붙인다. T-1552 의 "다섯 번째" 문형은
  **복사 금지**.
- [ ] **AC 3 — 계수 함정 ② (재분류 0, 5 연속) 반영.** slice 27 의 대상 `GET /api/contributions?assessmentId=`
  는 **slice 5 가 이미 실측한 route**(인벤토리 (A) `672 행`) 이므로 도메인 **15 불변** · 조회 route
  **31 불변** · 인벤토리 (A) **30 불변** · (B) **0 불변** · (C) **0 불변** · 자체 검산
  `A + B = 30 + 0 = 30` **불변** · (C) 검산식 `실측 31 + (B) 0 = 31` **불변** 이다. **(A) 표에 행을
  추가하지 않고**, 재분류 이력 · 셈법 서술(`574~580 행` 부근)에 slice 27 이 **재분류 0 인 다섯 번째
  연속 slice** 임을 1 구절로 덧붙인다 — T-1552 의 **"4 연속" 문형을 복사하지 않는다**.
- [ ] **AC 4 — baseline 확정 축 세 번째 route 서술 (본 task 고유, 소진 아님 병기).** 세 문서 중
  최소 각 1 곳에 slice 27 이 **잔여 축 (c) baseline 확정의 세 번째 route**(첫 진입은 slice 25,
  두 번째는 slice 26) 임을 적는다 — `measureAndConfirmBaseline` 의 **established / compared** 양
  국면을 **`Person → Assessment → Contribution` 3-level FK chain** 위에서 성립시켰고 부모 A 5 건 ·
  부모 B 3 건 두 표본으로 부모 필터 분해력을 관측했으며, 같은 route 를 관찰 전용으로 잰 slice 5 와
  대조가 된다는 두 축. **같은 자리에 소진 아님을 반드시 병기** 한다 — baseline 은 **임시 디렉토리
  1 회성** 이고 repo 체크인 기준 baseline · CI job 편입 · 임계 fix 는 **전부 미착수** 다.
- [ ] **AC 5 — PLAN `142 행` 갱신.** ① perf-spec 개수 `60` → **61**, read 경로는 **51 그대로 두되**
  괄호 안 설명을 **slice 27 기준**(파일명 `contribution-measure-confirm-realdb.perf-spec.ts` 에
  `read` 가 없어 glob 51 불변)으로 정정, 범위 표기 `T-0830~T-1551` → **`T-0830~T-1553`**, ② "실 DB
  round-trip 실측이 **slice 26 까지 도달**" → **slice 27 까지 도달** 로 확장하고
  `contribution-measure-confirm-realdb.perf-spec.ts` (T-1553, main `856687bf`, `it(` 실측 수) 가
  **`GET /api/contributions?assessmentId=` 를 실 JWT 로 호출해 measure → confirm-or-compare loop 의
  established / compared 양 분기를 3-level FK chain 위에서 성립시켰고 p95 < 3000ms 를 유지함을
  실측** 했다는 1 ~ 2 문장 추가 (**baseline 은 임시 디렉토리 1 회성** 1 구절 + **두 run 의 대소
  관계와 `regressed` 는 미단언 관찰 기록** 1 구절 + **collector / assert 배선 · 주입 임계 fail
  분기 · errorRate 분기 · 401 guard 생존은 slice 1~26 과 동일해 새 축 아님** 1 구절), ③ 말미 계수
  나열을 **perf-spec 61 / read 51 / 실 DB 27 / read 21 / 도메인 15 / 조회 route 31** 로 갱신,
  ④ task 링크 목록에 T-1553 추가. **checkbox `[ ]` 는 유지** (완료 선언 금지).
- [ ] **AC 6 — 부하계획 `§ 5` item 5 본문 갱신.** "slice 26 까지 도달" 서술(`135 행`)에 slice 27
  (T-1553, main `856687bf`, `it(` 실측 수) 를 **1 ~ 2 문장으로 병기** 하되 실측 범위
  **15 endpoint (조회 31 route)** 는 **불변** 임을 명시한다. `534 행` · `550~552 행` 부근 셈법
  서술에는 slice 27 도 **도메인도 route 도 늘리지 않는다**(같은 route 의 다른 harness) 는 점을
  AC 3 의 "5 연속" 문형으로 이어 적는다. `**잔여**` 의 "나머지 read perf-spec 30 개는 service mock
  잔존" 과 계산식은 **문구 그대로 두고** AC 2 의 이유 1 구절만 덧붙인다. **"본 item 은 미완" 결론
  유지**(`579 행`) — `writeBaselineFile` / `confirmOrCompareBaseline` 서술을 손볼 때도 **slice 25 ·
  26 · 27 만 예외적으로 baseline 을 확정했고 그것도 임시 디렉토리 1 회성** 이라는 단서를 반드시
  붙이며, baseline 미확정 · 임계 fix 미착수 결론을 삭제하거나 완화하지 않는다.
- [ ] **AC 7 — 규모 축 3 route 불변 확인 (계수 함정 ③).** 부하계획 규모 민감도 단락
  (`635 행` · `641~649 행` 부근) 과 오독 차단 단락(`737~741 행` 부근) 의 **세 route 도달** 서술을
  **그대로 유지** 하고 4 로 올리지 않는다. slice 27 이 **규모 축 slice 가 아님**(부모 A 5 건 vs
  부모 B 3 건은 규모 비교가 아니라 부모 필터 분해력 관측) 을 1 구절로만 덧붙이며, 자식 건수 차이가
  "규모 민감도 표본" 으로 읽히지 않도록 쓴다.
- [ ] **AC 8 — 인벤토리 머리말만 갱신, 표 · 분류는 전부 불변.** `652 행` 의
  "(slice 26 시점 확인분, T-1536 작성 → T-1552 갱신)" 을
  **"(slice 27 시점 확인분, T-1536 작성 → T-1554 갱신)"** 으로 고치고 머리말의 편집 전 실측 개수
  4 종 (`60`·`51`·`26`·`21`) 을 **`61`·`51`·`27`·`21`** 로 갱신한다. 그 외 (A) 제목 · (A) 표 30 행
  (특히 `672~673 행` contribution 2 행) · (B) 절(0 개) · **보수 분류 단락** · (C) 절 · 현 시점
  확인분 단락 · 자체 검산 은 **한 글자도 의미를 바꾸지 않는다** (AC 3).
- [ ] **AC 9 — 오독 차단 단락 보존 + 완료 선언 0 (계수 함정 ④).** 오독 차단 단락(`737~745 행` 부근)
  의 `(B) + (C) = 0 + 0 = 0 route` 와 그 유보 문장 — (A) 부류 mock spec **30 개 retire 판단 미착수** ·
  **write / trigger route 는 목록 밖** · **30 은 잔여의 상한도 하한도 아님** · **(B) 0 은 조회 성능
  검증 완료가 아님** · **slice 25 의 baseline 첫 진입 · slice 26 의 두 번째 route 도 잔여 소진이
  아님** — 을 **전부 보존** 하고, slice 27 이 route 를 하나 더 더한 것 역시 소진이 아님을 같은
  자리에 1 구절로 잇는다. 세 문서 어디에도 **"잔여 소진" · "baseline 확정 완료" · "잔여 축 (c)
  해소" · "규모 축 해소" · "성능 검증 완료"** 로 읽히는 표현을 쓰지 않는다.
- [ ] **AC 10 — REQ-048 재판정 갱신 + 표 구조 보존.** `docs/requirements.md` REQ-048 행(`67 행`)의
  "한계 — 실 DB 축은 부분 해소" 문장에 slice 27 을 반영한다 — 파일명 · task · main SHA ·
  test 수(`it(` 실측) · **질적 차이(baseline 확정 축 세 번째 route · 3-level FK chain 의 첫 실 DB
  baseline 배선)** · **endpoint 수 15 · 조회 31 route 불변** · 계산식
  `read 51 개 − 실 DB read 21 개` (차이 30, **식 불변**) · **baseline 은 임시 디렉토리 1 회성** .
  **status 토큰 `IN_PROGRESS` 불변**, "시각화(web) 렌더 측정 축 부재" · "실 scale 부하 미검증" ·
  "baseline 확정 · 임계 fix 미완" 서술도 **불변**. 새로 넣는 문장에 **파이프 `|` 문자를 쓰지
  않고**(필요하면 "OR" 로 풀어 쓴다), 편집 후 `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와
  파이프 개수 **8 불변** 을 확인한다.
- [ ] **AC 11 — REQ-047 오독 차단.** 세 문서 어디에도 slice 27 의 표본이 REQ-047 실 scale 부하
  (100~200명 / 50~100 repo / ~1000 confluence page / 1h) 충족으로 읽히는 표현을 쓰지 않는다 —
  slice 27 은 애초에 규모 축이 아니라 **소규모 seed(부모 A 5 건 · 부모 B 3 건) 위의 baseline loop
  배선** 임을 오독 여지 없이 서술하며, REQ-047 행 (`66 행`) 은 **수정하지 않는다**.
- [ ] **AC 12 — 잔여 축 보존 검산.** 갱신 후에도 세 문서에 다음 4 잔여가 살아 있어야 한다 —
  (a) 나머지 read perf-spec 30 개 mock 잔존, (b) **규모 축은 3 route 한정 · 다른 endpoint 미측정**,
  (c) **baseline 파일 확정(repo 체크인) · CI job 편입 · 임계 fix 미완** — slice 25 · 26 · 27 세
  route 의 진입이 이 잔여를 지우지 않는다, (d) 시각화(web) 렌더 측정 축 부재 + REQ-047 실 scale
  부하 미검증. 하나라도 삭제됐으면 되돌린다. 아울러 PLAN `140 행` 성능 검증 checkbox 가 `[ ]`
  그대로 · REQ-048 status 가 `IN_PROGRESS` 그대로 · 부하계획 `§ 5` item 5 가 여전히 미완으로
  읽히는지 세 지점을 각각 확인한다.
- [ ] **AC 13 — 범위 표기 규약 준수 + 크기 검산.** 본 task 가 **새로 추가하는** 행 좌표 표기는
  [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기" (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를
  따른다 — 구분자는 `~`, 단일 행은 `142 행`, `L` prefix 금지, **기존 행의 소급 치환 금지**.
  마지막에 `git diff --stat` 이 **3 파일(+ 본 task 파일) / ≤ 300 LOC** 임을 확인한다 (코드 변경 0
  이라 test 는 불요 — §3.2 R-110 의 direct doc-only 면제).

## Out of Scope

- **코드 · spec 변경 일체** (`test/` · `src/` · `prisma/`) — 본 task 는 doc-only `direct` 다.
  [test/perf/README.md](../../test/perf/README.md) 도 **수정하지 않는다** (T-1553 이 이미 slice 27
  bullet 과 잔여 계수를 박제했다 — 인용만).
- **repo 체크인 baseline JSON 확정 · CI job 편입 · 임계값 변경** — 부하계획 `§ 5` #4 · #5 잔여는
  본 doc-sync 로 해소되지 않는다. `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **perf slice 28 착수 · 다음 축 선정** — (A) 부류 mock spec 30 개 retire · baseline 파일 repo
  확정 + 임계 fix · 네 번째 route 의 measure→confirm 배선 · 다른 endpoint 규모 민감도 · web 렌더
  측정 중 무엇을 다음으로 삼을지는 **planner 의 다음 호출 몫** 이다. 본 task 는 후속 방향을 문서에
  결론으로 적지 않는다 (Follow-ups 에만).
- **규모 축 route 수 변경** (AC 7) — slice 27 은 규모 축이 아니므로 3 route 를 4 로 올리지 않는다.
- **인벤토리 (A) 표 · (B) · (C) · 보수 분류 단락 · 자체 검산 수정** (AC 3 · AC 8) — slice 27 은
  재분류 0 이다. 특히 `672~673 행` 의 contribution 2 행을 slice 27 로 고쳐 적지 않는다 (그 행의
  근거 slice 는 slice 5 그대로다).
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — mock 짝
  (`contribution-*.perf-spec.ts` 계열) 을 slice 27 이 대체하는지 여부는 T-1536 이 명시 유보한 별도
  판단이고 `test/` 변경이라 `pr` 이다. Follow-ups 에만 적는다.
- **`ContributionService` · FK chain 쿼리의 성능 재판정 · 인덱스 추가 제안 · 페이지네이션 도입
  제안** — slice 27 이 관측한 수치를 **판단 없이 인용만** 하고 개선 제안을 문서에 적지 않는다
  (`prisma/schema.prisma` 변경은 §5 DB schema BLOCKED 게이트 대상이기도 하다).
- **PLAN 성능 검증 checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 선언** (AC 9 · AC 12).
- **REQ-047 행 수정** (AC 11) · **REQ-057 / REQ-026 / REQ-045 행 재판정**.
- **write / trigger route 의 인벤토리화** — 인벤토리 범위는 **read (조회) route** 뿐이라는 기존
  경계 문장을 유지하고 확장하지 않는다.
- **행 좌표 표기 소급 정규화** — 기존 표기는 그대로 둔다 (AC 13).
- **ADR status flip · 새 dependency 도입 · `docs/architecture/*` 편집** — §3.1 상 `pr` 이거나
  §5 BLOCKED 게이트 대상.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

- **perf slice 28 착수 축 선정** — (A) 부류 mock spec 30 개 retire 판단 · baseline 파일 repo 체크인
  확정 + CI job 편입 + 임계 fix · 네 번째 route 의 measure→confirm 실 DB 배선 · 다른 endpoint 규모
  민감도 · web 렌더 측정 중 무엇을 먼저 잡을지는 planner 몫이다 (본 task 는 결론을 문서에 적지
  않았다 — Out of Scope).
- **인벤토리 머리말 갱신 조건 박제** (T-1546 → T-1548 → T-1550 → T-1552 이월) — 재분류가 0 인
  slice 가 이제 **5 연속** 이어지며 `잔여 read route 인벤토리` 머리말의 "slice N 시점 확인분" 과
  계수 4 종만 갱신되는 doc-sync 가 반복되고 있다. 머리말 갱신 조건을 인벤토리 절 자체에 1 구절로
  박제할지 별도 판단 필요 (5 연속으로 근거가 더 두터워졌다).
- **mock 짝 대체 판단** — slice 25 · 26 · 27 로 measure→confirm harness 가 mock · 실 DB 두 판본을
  갖는 route 가 **3 개** 로 늘었다. mock 판본 retire 여부는 T-1536 유보 축과 함께 판단한다.
- **baseline 확정 축의 (c) 잔여 소진 시점 판정** — route 가 3 개까지 늘었으므로, 몇 번째 route
  까지 배선해야 (c) 축 진전이 "repo 체크인 baseline + CI job 편입" 단계로 넘어갈지 planner 가
  별도 판단할 시점이 가까워졌다 (본 task 는 결론 0).

## Result (2026-08-10T12:45Z)

- **DONE** — `direct` doc-only commit `5a6af52d` (main). 변경 **3 파일 `+53/-19`** (cap 이내):
  `docs/PLAN.md` `142 행` 계수 · slice 27 서술 · task 링크, `docs/ops/load-resilience-test-plan.md`
  `§ 5` item 5 본문 · glob 셈법 · 규모 축 · 인벤토리 머리말 · 오독 차단, `docs/requirements.md`
  REQ-048 재판정.
- 계수 = perf-spec **60 → 61** · 실 DB round-trip **26 → 27**, `*read*` **51 불변**(여섯 번째 사례) ·
  실 DB read **21 불변** → 재분류 0 이 **5 연속**. 정본 `test/perf/README.md` 는 인용만 하고 미수정
  (`§3.1` rule 3 정합).
- baseline 축에 **세 번째 route**(`GET /api/contributions`, 3-level FK chain — 부모 A 5 건 / B 3 건)
  를 병기하고 "(c) 축 소진 아님" 을 함께 명시.
- **완료 선언 0 유지** — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 item 5 미완(잔여 4 축) 보존.
- AC 1~13 전부 ok. **R-110 면제** — 코드 · spec 변경 0 의 direct doc-only (문서 참조 drift-guard spec 부재 확인).
- CI: main run `31389515939` 은 turn 종료 시점 **in_progress** → 다음 fire 가 conclusion 재확인 (R-114 위임).
