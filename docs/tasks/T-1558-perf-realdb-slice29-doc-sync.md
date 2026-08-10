---
id: T-1558
title: 실 DB perf slice 29(T-1557) GET /api/persons measure→confirm baseline 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: DONE
completedAt: 2026-08-10T20:56:00Z
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-08-10
createdAt: 2026-08-10T19:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1557]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1557 이 §3.1 rule 3 로 이월한 direct doc-sync — perf-spec 62 → 63 · 실 DB 28 → 29, read glob 51/21 불변(여덟 번째) · 재분류 0 은 7 연속 (완료 선언 0)"
---

# T-1558 — 실 DB perf slice 29 doc-sync (`GET /api/persons` measure→confirm baseline loop)

## Why

[T-1557](T-1557-perf-realdb-slice29-person-measure-confirm.md) 이 PR
[#1239](https://github.com/myungjoo/Assessment-Agent/pull/1239) 로 머지돼 (main `b77e944e`)
`test/perf/person-measure-confirm-realdb.perf-spec.ts` (it **11** 개) 가
`measureAndConfirmBaseline` 의 measure → confirm-or-compare top loop 를 **다섯 번째 route** 인
`GET /api/persons` 위에 태웠다. 그런데 T-1557 의 Out of Scope 가 [CLAUDE.md](../../CLAUDE.md)
`§3.1` rule 3 (direct · pr mixed 금지) 에 따라 PLAN · 부하계획 · REQ-048 갱신을 **머지 후 별도
direct task** 로 명시 이월했다. 그 결과 3 문서가 아직 **slice 28 시점 전제** 다 —
[PLAN.md](../PLAN.md) `142 행` 의 "`*.perf-spec.ts` **62 개**" · "실 DB round-trip 실측이
**slice 28 까지 도달**" · 범위 표기 `T-0830~T-1555` 가 stale 하고, 부하계획 `135 행` 머리말 ·
`§ 5` item 5 본문(`576 행` 부근 slice 28 절 · `597 행` · `625 행` 부근 셈법 · `648 행` 부근 glob
셈법) · `717 행` 인벤토리 머리말 · `804~823 행` 부근 오독 차단 단락 · [requirements.md](../requirements.md)
`67 행` REQ-048 행도 전부 slice 28 시점이다. [test/perf/README.md](../../test/perf/README.md) 는
T-1557 이 이미 slice 29 bullet 과 잔여 계수를 박제한 **계수 정본** 이므로 본 task 는 그것을
**인용만** 하고 수정 0 이다 (README 수정은 `§3.1` 상 pr 로 갈려 direct · pr mixed 를 만든다).
본 task 는 [T-1554](T-1554-perf-realdb-slice27-doc-sync.md) ·
[T-1556](T-1556-perf-realdb-slice28-doc-sync.md) 가 slice 27~28 에 대해 수행한 doc-sync 의
**slice 29 판** 이다.

**본 doc-sync 고유 대상 ① — baseline 확정 축의 다섯 번째 route 다 (네 번째가 아니다).**
slice 25(`GET /api/summaries`) 가 (c) 축에 처음 진입, slice 26(`GET /api/assessments`) 이 두 번째,
slice 27(`GET /api/contributions`) 이 세 번째, slice 28(`GET /api`) 이 네 번째였고 본 slice 가
**다섯 번째** 다. T-1556 의 "네 번째 route" 문형을 그대로 복사하면 서수가 틀린다.

**고유 대상 ② — guard 미부착 + DB 접촉 조합 위의 첫 baseline 확정이다.** slice 25~27 은
guard 부착 + DB 접촉 (실 JWT 로 `JwtAuthGuard` 통과) 이었고, slice 28 은 guard 미부착 + **DB
미접촉** 이라 framework + HTTP 왕복만의 하한(floor) 이었다. 본 slice 는 `PersonController` 가
guard 미부착이면서 요청 경로가 실 Postgres 를 왕복하는 조합이라, `overrideGuard` **0** · mock
**0** 의 `createE2EApp` 부트스트랩 위에서 **인증 layer 노이즈 0 인 순수 DB 왕복 몫** 을 slice 28 의
floor 와 **같은 harness 위에서 대조** 할 수 있게 한다. 관측 축으로는 soft-delete 필터의 두 국면
(삭제 전 / 삭제 후) 을 established · compared 양 국면에서 대조한 점이 앞 네 slice 에 없던 부분이다.
같은 route 를 collector 개별 배선으로만 잰 slice 1(`person-read-realdb.perf-spec.ts`, T-1500) 과의
대조 관계도 함께 적는다.

**계수 함정 ① — `read` glob 두 개 다 이번에도 불변 (여덟 번째 사례).** 신규 파일명
`person-measure-confirm-realdb.perf-spec.ts` 에는 `read` 가 **없다** (slice 3 · 23 · 24 · 25 · 26 ·
27 · 28 에 이은 **여덟 번째**). 실측 확인값: `*read*` **51 불변** · `*read*realdb*` **21 불변** 이라
`read 51 − 실 DB read 21 = 30` 이 **식도 결과도 그대로** 다. 늘어나는 것은 `*.perf-spec.ts`
**62 → 63** 과 `*realdb*` **28 → 29** 뿐이다. T-1556 의 "**일곱 번째** 사례" 문형은 복사하면 틀린다.

**계수 함정 ② — 재분류 0 이 7 연속 (6 연속이 아니다).** 대상 `GET /api/persons` 는 **slice 1 이
이미 실측한 route** 이므로 도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30 불변** ·
(B) **0 불변** · (C) **0 불변** · mock 잔존 **30 불변** 이며 (A) 표에 행을 추가하지 않는다.
slice 23 을 "첫" 으로 세면 slice 29 는 **7 연속** 이다.

**계수 함정 ③ — 규모 축은 3 route 그대로.** 본 slice 는 **규모 축 slice 가 아니다** — soft-delete
전/후 두 국면 대조는 규모 비교가 아니라 **필터 분해력** 관측이다. 부하계획 `696~711 행` 규모 축
단락과 `804 행` 부근 오독 차단 단락의 **3 route** 서술을 4 로 올리지 않는다.

**계수 함정 ④ — 완료 선언 0 (본 task 최대 함정).** baseline 축이 route **5 개** 로 늘고
guard × DB 조합의 빈 칸이 채워진 사실이 "(c) 축 해소" 로 읽힐 위험이 크다. 그러나 slice 29 의
baseline 도 **임시 디렉토리 1 회성** 이고 **저장소 체크인 기준 baseline(`§ 5` #5) · CI job
편입(`§ 5` #4) · 임계 fix 는 전부 미착수** 다. 잔여 4 축 — (a) (A) 부류 mock spec 30 개 retire
판단, (b) 다른 endpoint 규모 민감도, (c) baseline 확정 · 임계 fix, (d) web 렌더 측정 + REQ-047 실
scale 부하 — 이 **넷 다 그대로** 이며 PLAN `140 행` checkbox `[ ]` · REQ-048 `IN_PROGRESS` ·
부하계획 item 5 미완 결론(`630 행` 부근 · `823 행` 부근) 을 **전부 유지** 한다.

## Required Reading

- [docs/tasks/T-1557-perf-realdb-slice29-person-measure-confirm.md](T-1557-perf-realdb-slice29-person-measure-confirm.md)
  — 본 doc-sync 의 사실 원천 (`## Why` 고유 축 + `## Result` 절: PR #1239 · main `b77e944e` ·
  2 파일 `+292/-7` · it 11 개).
- [docs/tasks/T-1556-perf-realdb-slice28-doc-sync.md](T-1556-perf-realdb-slice28-doc-sync.md) —
  직전 slice 의 doc-sync 형식 선례. 단 **"일곱 번째" · "6 연속" · "네 번째 route" 문형은 복사
  금지** (본 task 는 각각 여덟 번째 · 7 연속 · **다섯 번째 route** 다).
- [test/perf/README.md](../../test/perf/README.md) 의 slice 29 bullet 과 잔여 절 — 계수 **정본**.
  **인용만 하고 수정 0**.
- [test/perf/person-measure-confirm-realdb.perf-spec.ts](../../test/perf/person-measure-confirm-realdb.perf-spec.ts)
  의 헤더 주석과 `it(` 목록 — 문서에 적을 test 수의 실측 출처 (편집 전 실측 **11**). **수정 금지**.
- [docs/PLAN.md](../PLAN.md) `140~142 행` — 성능 검증 bullet + REQ-048 하위 항목 (갱신 대상 1).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 —
  갱신 대상 2. 머리말 `135 행`, slice 나열 말미 `576 행` 부근, 셈법 서술 `597 행` · `625 행` ·
  `632 행` 부근, glob 셈법 `648 행` 부근, 규모 축 `696~711 행` 부근, 인벤토리 머리말 `717 행`,
  오독 차단 `804~823 행` 부근.
- [docs/requirements.md](../requirements.md) `67 행` REQ-048 행 — 갱신 대상 3. **markdown 표 행**
  이라 본문에 파이프 `|` 를 새로 넣으면 셀이 쪼개진다 (필요하면 "OR" 로 풀어 쓴다). 현재 파이프
  **8 개** · **1 행** 이다.

## Acceptance Criteria

- [ ] **AC 1 — 편집 전 실측 확인.** `ls test/perf/*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*.perf-spec.ts | wc -l` · `ls test/perf/*realdb*.perf-spec.ts | wc -l` ·
  `ls test/perf/*read*realdb*.perf-spec.ts | wc -l` 이 각각 **63** · **51** · **29** · **21** 임을
  확인하고, 문서에 적는 개수는 이 실측값만 쓴다 (추정 금지). test 수는
  `grep -c "^\s*it(" test/perf/person-measure-confirm-realdb.perf-spec.ts` 실측값(**11**) 을 쓴다.
- [ ] **AC 2 — PLAN `142 행` 갱신.** ① `*.perf-spec.ts` **62 → 63**, read 경로는 **51 그대로 두되**
  괄호 안 설명을 slice 29 기준(파일명 `person-measure-confirm-realdb.perf-spec.ts` 에 `read` 가
  없어 glob 51 불변)으로 정정, 범위 표기 `T-0830~T-1555` → **`T-0830~T-1557`**, ② "실 DB
  round-trip 실측이 **slice 28 까지 도달**" → **slice 29 까지 도달**, ③ slice 29 절(대상
  `GET /api/persons` · 파일명 · T-1557 · main `b77e944e` · it 11 개 · 고유 대상 ①~② 요지 ·
  p95 < 3000ms 유지)을 기존 나열 말미에 1~2 문장으로 잇되 **baseline 은 임시 디렉토리 1 회성** ·
  **두 run 의 대소 관계와 `comparison.regressed` 는 미단언 관찰 기록** · **collector / assert 배선 ·
  주입 임계 fail 분기 · errorRate 분기는 slice 1~28 과 동일해 새 축 아님** 3 구절을 병기,
  ④ 말미 계수 나열을 **perf-spec 63 / read 51 / 실 DB 29 / read 21 / 도메인 15 / 조회 route 31** 로
  갱신하고 task 링크 목록에 T-1557 추가.
- [ ] **AC 3 — 부하계획 `§ 5` item 5 본문 갱신.** 머리말(`135 행`) 의 "slice 28 까지 도달" 을
  **slice 29 까지 도달** 로 바꾸고 slice 28 절(`576 행` 부근) 뒤에 slice 29 절을 잇는다 —
  **다섯 번째 route** · **guard 미부착 + DB 접촉 조합의 첫 baseline**(slice 28 floor 와 같은
  harness 대조) · soft-delete 두 국면 대조 · slice 1 과의 대조 관계. 실측 범위
  **15 endpoint (조회 31 route)** 는 **불변** 임을 같은 자리에 명시한다.
- [ ] **AC 4 — 계수 함정 ① 검산 (glob 두 개 다 불변, 여덟 번째 사례).** `*read*` **51 불변** ·
  `*read*realdb*` **21 불변** 이고 `read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로**
  임을 확인해 세 문서에서 이 계산식과 30 을 건드리지 않되, **파일명에 `read` 가 없는 여덟 번째
  사례** 임을 부하계획 glob 셈법 서술(`648 행` 부근)에 1 구절로 덧붙인다. "일곱 번째" 문형 복사 금지.
- [ ] **AC 5 — 계수 함정 ② (재분류 0, 7 연속) 반영.** 대상은 slice 1 이 이미 실측한 route 이므로
  도메인 **15** · 조회 route **31** · 인벤토리 (A) **30** · (B) **0** · (C) **0** · mock 잔존
  **30** · 자체 검산 `A + B = 30 + 0 = 30` · `실측 31 + (B) 0 = 31` 이 **전부 불변** 이다.
  **(A) 표에 행을 추가하지 않고** 셈법 서술(`597 행` · `625 행` 부근)에 slice 29 가 **재분류 0 인
  7 연속째** 임을 1 구절로 덧붙인다 ("6 연속" 문형 복사 금지).
- [ ] **AC 6 — 규모 축 3 route 불변 (계수 함정 ③).** 부하계획 규모 축 단락(`696~711 행` 부근) 과
  오독 차단 단락(`804 행` 부근) 의 **3 route** 서술을 그대로 두고 4 로 올리지 않는다. slice 29 가
  규모 축 slice 가 아님(soft-delete 전/후 대조는 규모 비교가 아니라 필터 분해력 관측) 을 1 구절로만
  덧붙이며, 그 두 국면이 "규모 민감도 표본" 으로 읽히지 않게 쓴다.
- [ ] **AC 7 — 인벤토리 머리말만 갱신, 표 · 분류는 전부 불변.** `717 행` 의
  "(slice 28 시점 확인분, T-1536 작성 → T-1556 갱신)" 을
  **"(slice 29 시점 확인분, T-1536 작성 → T-1558 갱신)"** 으로 고치고 머리말의 편집 전 계수
  4 종(`62`·`51`·`28`·`21`) 을 **`63`·`51`·`29`·`21`** 로 갱신한다. (A) 제목 · (A) 표 30 행(특히
  person 행) · (B) 절 · 보수 분류 단락 · (C) 절 · 현 시점 확인분 단락 · 자체 검산 은 **한 글자도
  의미를 바꾸지 않는다**.
- [ ] **AC 8 — 오독 차단 단락 보존 + 완료 선언 0 (계수 함정 ④).** 오독 차단 단락(`804~823 행`
  부근) 의 `(B) + (C) = 0 + 0 = 0 route` 와 유보 문장 — (A) 부류 mock spec 30 개 retire 판단
  미착수 · write / trigger route 는 목록 밖 · 30 은 잔여의 상한도 하한도 아님 · (B) 0 은 조회 성능
  검증 완료가 아님 · slice 25~28 의 route 추가도 잔여 소진이 아님 — 을 **전부 보존** 하고, slice 29
  가 다섯 번째 route 를 더한 것 역시 소진이 아님을 같은 자리에 1 구절로 잇는다. 세 문서 어디에도
  **"잔여 소진" · "baseline 확정 완료" · "잔여 축 (c) 해소" · "규모 축 해소" · "성능 검증 완료"**
  로 읽히는 표현을 쓰지 않는다.
- [ ] **AC 9 — REQ-048 재판정 갱신 + 표 구조 보존.** `docs/requirements.md` `67 행` 의 "한계 — 실
  DB 축은 부분 해소" 서술에 slice 29 를 반영한다 — 파일명 · task(T-1557) · main SHA `b77e944e` ·
  test 수 11 · **질적 차이(baseline 확정 축 다섯 번째 route · guard 미부착 + DB 접촉 조합의 첫
  baseline)** · **endpoint 15 · 조회 31 route 불변** · 계산식 `read 51 개 − 실 DB read 21 개`(차이
  30, 식 불변) · **baseline 은 임시 디렉토리 1 회성**. status 토큰 **`IN_PROGRESS` 불변**, "시각화
  (web) 렌더 측정 축 부재" · "실 scale 부하 미검증" · "baseline 확정 · 임계 fix 미완" 서술도 불변.
  새 문장에 파이프 `|` 를 쓰지 않고, 편집 후 `sed -n '67p' docs/requirements.md` 로 **1 행 유지** 와
  파이프 **8 불변** 을 확인한다.
- [ ] **AC 10 — 완료 선언 0 검산 3 지점.** PLAN `140 행` 성능 검증 checkbox 가 `[ ]` 그대로,
  REQ-048 판정이 `IN_PROGRESS` 그대로, 부하계획 `§ 5` item 5 가 여전히 미완(`630 행` 부근 ·
  `823 행` 부근) 으로 읽히는지 세 지점을 각각 확인한다. 아울러 잔여 4 축 (a)~(d) 가 갱신 후에도
  세 문서에 살아 있는지 확인하고, 하나라도 삭제됐으면 되돌린다.
- [ ] **AC 11 — 서수 · 연속 횟수 검산.** 갱신 후 3 문서에서
  `grep -n "여덟 번째\|7 연속\|다섯 번째 route"` 로 신규 문구가 각각 1+ 존재하고, slice 29 를
  가리키는 자리에 "일곱 번째" · "6 연속" · "네 번째 route" 가 **새로 추가되지 않았음** 을 확인한다
  (기존 slice 28 서술의 해당 표현은 그대로 둔다).
- [ ] **AC 12 — 범위 · 언어 · 크기 검산.** 신규 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) `§12`
  범위 좌표 규약(`~` 구분자 · 단일 행은 `142 행` · `L` prefix 금지 · 소급 치환 금지) 을 따르고,
  문서 본문은 한국어 · 경로 · 식별자 · glob 은 영어 그대로다. `git status --porcelain` 결과가
  frontmatter `touchesFiles` 3 개(+ 본 task 파일) 뿐이고 `git diff --stat` 이 **≤ 300 LOC ·
  ≤ 5 파일** 임을 확인한다.

**R-110 면제 근거** — 본 task 는 코드 변경 0 의 `direct` doc-only 라 tester 미호출이 규정상
허용된다 (CLAUDE.md `§3.2` R-110 단서). 대신 glob 4 종(63/51/29/21) 실측 · `it(` 실측 ·
`sed -n '67p'` 파이프 검산 · `git diff --stat` 로 대체한다. R-112 4 항목(happy / error / 분기 /
negative)은 production code 변경이 없어 **적용 대상 아님** — 해당 test 는 T-1557 이 이미 it 11 개
(happy 2 국면 · 분기 2 · error 2 · negative 5)로 박제했다.

## Out of Scope

- **`test/perf/README.md` 수정** — 계수 정본은 T-1557 이 이미 slice 29 bullet 을 박제했다. 본 task 는
  인용만 한다 (수정 시 `§3.1` direct · pr mixed 발생).
- **코드 · spec 변경 일체** (`test/` · `src/` · `prisma/` · `.github/workflows/`) — doc-only `direct`.
- **저장소 체크인 baseline JSON 확정 · CI job 편입 · 임계값 변경** — 부하계획 `§ 5` #4 · #5 잔여는
  본 doc-sync 로 해소되지 않는다. `DEFAULT_P95_MAX_MS = 3000` 및 "baseline 후 fix" 서술 불변.
- **완료 선언** — PLAN `140 행` checkbox 체크 · REQ-048 status flip · 부하계획 item 5 완료 표기 금지.
- **인벤토리 (A) 표 · (B) · (C) · 보수 분류 단락 · 자체 검산 수정** (AC 5 · AC 7) — 특히 (A) 표의
  person 행을 slice 29 로 고쳐 적지 않는다 (그 행의 근거 slice 는 slice 1 그대로다).
- **규모 축 route 수 변경** (AC 6) — 3 을 4 로 올리지 않는다.
- **(A) 부류 mock perf-spec 30 개의 retire · 삭제 · 통합** — T-1536 이 명시 유보한 별도 판단이고
  `test/` 변경이라 `pr` 이다. Follow-ups 에만 적는다.
- **`PersonService` · soft-delete 필터의 성능 재판정 · 인덱스 추가 · 페이지네이션 도입 제안** —
  관측 수치를 판단 없이 인용만 한다 (`prisma/schema.prisma` 변경은 `§5` DB schema BLOCKED 게이트
  대상이기도 하다).
- **REQ-047 행 수정 · REQ-047 실 scale 부하 충족 주장** — slice 29 는 소규모 seed 위의 baseline
  loop 배선일 뿐이다. 그렇게 읽힐 표현 금지.
- **perf slice 30 착수 · 다음 축 선정** — 본 task 는 후속 방향을 문서에 결론으로 적지 않는다
  (Follow-ups 에만).
- **행 좌표 표기 소급 정규화 · ADR status flip · 새 dependency · `docs/architecture/*` 편집**.

## Suggested Sub-agents

`implementer` (architect · tester 불요 — 새 결정 0, 코드 변경 0 의 doc-only 정합).

## Follow-ups

- **인벤토리 머리말 갱신 조건 박제** (T-1546 → T-1548 → T-1550 → T-1552 → T-1554 → T-1556 이월) —
  재분류 0 인 slice 가 **7 연속** 이어지며 머리말의 "slice N 시점 확인분" 과 계수 4 종만 갱신되는
  doc-sync 가 반복된다. 갱신 조건을 인벤토리 절 자체에 1 구절로 박제할지 별도 판단 필요 (근거가
  7 연속으로 충분히 두터워졌다).
- **체크인 baseline + CI job 편입 축의 선행 ADR** — baseline 확정 축이 route 5 개까지 늘었으므로
  "repo 체크인 baseline 파일의 저장 위치 · 갱신 주체 · 회귀 시 CI fail 여부" 를 ADR 로 먼저 결정할
  시점이 가까워졌다 (본 task 는 결론 0 — planner 몫).
- **mock 짝 대체 판단** — measure→confirm harness 가 mock · 실 DB 두 판본을 갖는 route 가 5 개로
  늘었다. mock 판본 retire 여부는 T-1536 유보 축과 함께 판단한다.

## Result (2026-08-10T20:56Z)

- **DONE** — `direct` doc-only commit `8b3f927b` (main push, PR 없음). 3 파일 `+50/-11`
  (cap `300 LOC / 5 파일` 이내): `docs/PLAN.md` `142 행` 계수 · 범위 · slice 29 절,
  `docs/ops/load-resilience-test-plan.md` 머리말 · `§ 5` item 5 · 셈법 · glob 셈법 · 규모 축 ·
  인벤토리 머리말 · 오독 차단 단락, `docs/requirements.md` REQ-048 행 재판정.
- 계수 실측 = `*.perf-spec.ts` **63** · `*read*` **51** · `*realdb*` **29** · `*read*realdb*` **21**.
  perf-spec **62 → 63** · 실 DB round-trip **28 → 29** 만 증가하고 `read` glob 두 개는 **불변**
  (**여덟 번째** 사례) → `51 − 21 = 30` 식도 결과도 보존, 재분류 0 이 **7 연속**.
- baseline 확정 축에 **다섯 번째 route**(`GET /api/persons` — guard 미부착 + DB 접촉 조합의 첫
  baseline)를 병기해 slice 28 의 DB 미접촉 floor 와 같은 harness 위에서 대조 가능함을 명시.
  규모 축은 **3 route 불변**(필터 분해력 관측만 추가).
- 정본 `test/perf/README.md` 는 T-1557 이 이미 slice 29 계수를 박제한 상태라 **인용만 하고 미수정**
  (`§3.1` rule 3 정합 — README 수정은 pr 로 갈려 direct · pr mixed 를 만든다).
- **완료 선언 0 유지** — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 `§ 5` item 5 미완
  (잔여 4 축) 3 지점 보존.
- AC 12 항목 전부 ok. **R-110 면제** — 코드 · spec 변경 0 의 direct doc-only. glob 실측 4 종 +
  `git diff --stat` 검산으로 대체.
- CI: main run `31430809321` 은 turn 종료 시점 **in_progress** → 다음 fire 가 conclusion 재확인
  (R-114 위임).
