---
id: T-1556
title: 실 DB perf slice 28(T-1555) GET /api(app root) measure→confirm baseline 실측을 PLAN·부하계획·REQ-048 3 문서에 반영
phase: P5
status: PENDING
commitMode: direct
coversReq: [REQ-048]
estimatedDiff: 110
estimatedFiles: 3
created: 2026-08-10
createdAt: 2026-08-10T15:40:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1555]
touchesFiles:
  - docs/PLAN.md
  - docs/ops/load-resilience-test-plan.md
  - docs/requirements.md
plannerNote: "T-1555 가 §3.1 rule 3 로 이월한 direct doc-sync — perf-spec 61 → 62 · 실 DB 27 → 28, read glob 51/21 불변(일곱 번째) · 재분류 0 은 6 연속 (완료 선언 0)"
---

# T-1556 — 실 DB perf slice 28 doc-sync (`GET /api` measure→confirm baseline loop)

## Why

[T-1555](T-1555-perf-realdb-slice28-app-root-measure-confirm.md) 가 PR
[#1238](https://github.com/myungjoo/Assessment-Agent/pull/1238) 로 머지돼 (main `4f444198`)
`test/perf/app-root-measure-confirm-realdb.perf-spec.ts` (it **11** 개) 가
`measureAndConfirmBaseline` 의 measure → confirm-or-compare top loop 를 **네 번째 route** 인
`AppController` 의 root health read `GET /api` 위에 태웠다. 그런데 T-1555 의 Out of Scope 가
[CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3 (direct · pr mixed 금지) 에 따라 PLAN · 부하계획 ·
REQ-048 갱신을 **머지 후 별도 direct task** 로 명시 이월했다. 그 결과 3 문서가 아직 **slice 27 시점
전제** 이고, [PLAN.md](../PLAN.md) `142 행` 의 "`*.perf-spec.ts` **61 개**" · "실 DB round-trip 실측이
**slice 27 까지 도달**" · 범위 표기 `T-0830~T-1553` 이 stale 하며, 부하계획 `135 행` 머리말과
`§ 5` item 5 본문, `648 행` 부근 인벤토리 오독 차단 단락, [requirements.md](../requirements.md)
`67 행` REQ-048 행도 전부 slice 27 시점이다. [test/perf/README.md](../../test/perf/README.md) 는
T-1555 가 이미 slice 28 bullet(`1074 행` 부근)과 잔여 계수를 박제한 **계수 정본** 이므로 본 task 는
그것을 **인용만** 하고 수정 0 이다 (README 수정은 `§3.1` 상 pr 로 갈려 direct·pr mixed 를 만든다).
본 task 는 [T-1550](T-1550-perf-realdb-slice25-doc-sync.md) ·
[T-1552](T-1552-perf-realdb-slice26-doc-sync.md) ·
[T-1554](T-1554-perf-realdb-slice27-doc-sync.md) 가 slice 25~27 에 대해 수행한 doc-sync 의
**slice 28 판** 이다.

**본 doc-sync 고유 대상 ① — baseline 확정 축의 네 번째 route 다 (세 번째가 아니다).**
slice 25(`GET /api/summaries`) 가 (c) 축에 처음 진입, slice 26(`GET /api/assessments`) 이 두 번째,
slice 27(`GET /api/contributions`) 이 세 번째였고 본 slice 가 **네 번째** 다. 앞 slice 문형을
그대로 복사하면 서수가 틀린다.

**고유 대상 ② — DB 미접촉 route 위의 첫 baseline 확정이다.** `getRoot()` 는
`AppService.getStatus()` 의 고정 상수를 동기 반환할 뿐이라, 실 `AppModule` + 실 Prisma 연결이
살아 있어도 요청 경로가 DB 를 **전혀 건드리지 않는다** (전량 truncate 전/후 양쪽에서 established ·
compared 두 국면 도달 + 200 · 상수 문자열 불변으로 실증). 따라서 본 baseline 은 **framework + HTTP
왕복만의 하한** 이고 앞 세 route 의 baseline 에서 "얼마가 DB 몫인가" 를 가늠할 대조 기준선이 된다.
slice 22(`app-root-read-realdb.perf-spec.ts`, T-1543) 는 **같은 route 를 collector 개별 배선으로만**
쟀고, 그 위의 top loop + 실 fs baseline round-trip 은 본 slice 가 처음이다.

**고유 대상 ③ — guard layer 가 없는 첫 measure→confirm 실 DB slice 다.** slice 25~27 의 negative 는
"cookie 미부착 → 401" 이었으나 `AppController` 는 guard 미적용이라 cookie 미부착도 변조 쿠키도
**200** 이다 (앞 세 slice 와 정반대). negative 5 종 = (a) cookie 미부착 200 · (b) 변조 토큰 200 ·
(c) 인접 미매칭 경로 404(500 아님) · (d) 인위 non-2xx 의 `errorRate = 1` 과 200 혼합의
`0 < errorRate < 1` · (e) `POST /api` 의 404(405 아님).

**계수 함정 ① — `read` glob 두 개 다 불변 (일곱 번째 사례).** 신규 파일명
`app-root-measure-confirm-realdb.perf-spec.ts` 에는 `read` 가 **없다** (slice 3 · 23 · 24 · 25 · 26 ·
27 에 이은 **일곱 번째**). 실측 확인값: `*read*` **51 불변** · `*read*realdb*` **21 불변** 이라
`read 51 − 실 DB read 21 = 30` 이 **식도 결과도 그대로** 다. 늘어나는 것은 `*.perf-spec.ts`
**61 → 62** 와 `*realdb*` **27 → 28** 뿐이다. T-1554 의 "**여섯 번째** 사례" 문형은 복사하면 틀린다.

**계수 함정 ② — 재분류 0 이 6 연속 (5 연속이 아니다).** 대상 `GET /api` 는 **slice 22 가 이미
실측한 route** 이므로 도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30 불변** ·
(B) **0 불변** · (C) **0 불변** · mock 잔존 **30 불변** 이다.

**계수 함정 ③ — 규모 축은 3 route 그대로.** 본 slice 는 seed 자체가 불요한 DB 미접촉 route 라
**규모 축 slice 가 아니다**. 부하계획 `648 행` 부근 오독 차단 단락에 slice 28 절을 덧붙일 때
"규모 축이 4 route 로 늘었다" 로 읽힐 표현을 쓰지 않는다.

**계수 함정 ④ — mock 4 개가 전부 실 DB 짝을 가졌다는 사실은 축의 소진이 아니다.** 본 slice 로
measure→confirm mock spec 4 개(summary · assessment · contribution · app-root) 전부가 실 DB 짝을
갖지만, 본 baseline 도 **임시 디렉토리 1 회성** 이라 저장소 체크인 기준 baseline 파일 확정
(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 **전부 미착수 그대로** 다. 따라서 PLAN `140 행`
checkbox `[ ]` · REQ-048 `IN_PROGRESS` · 부하계획 item 5 미완 결론을 **그대로 유지** 한다
(완료 선언 0).

## Required Reading

- [docs/tasks/T-1555-perf-realdb-slice28-app-root-measure-confirm.md](T-1555-perf-realdb-slice28-app-root-measure-confirm.md) — 본 doc-sync 의 사실 원천 (`## 결과` 절 포함).
- [docs/tasks/T-1554-perf-realdb-slice27-doc-sync.md](T-1554-perf-realdb-slice27-doc-sync.md) — 직전 slice 의 doc-sync 형식 선례 (그대로 복사 금지 — 서수·연속 횟수가 다름).
- [test/perf/README.md](../../test/perf/README.md) `1074 행` 부근 slice 28 bullet — 계수 정본 (인용만, 수정 0).
- [docs/PLAN.md](../PLAN.md) `140~142 행` (성능 검증 bullet + REQ-048 하위 항목).
- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) `§ 5` item 5 (`132~136 행` 부근 머리말 + 이어지는 slice 나열) 와 `648~666 행` 부근 인벤토리 오독 차단 단락.
- [docs/requirements.md](../requirements.md) `67 행` REQ-048 행 (한 줄 표 row — 말미 서술 갱신 대상).

## Acceptance Criteria

- [ ] `docs/PLAN.md` `142 행` 의 계수가 실측값으로 갱신된다: `*.perf-spec.ts` **62 개** · read 경로 **51 개** 불변 · 범위 표기 `T-0830~T-1555`. 검증: `ls test/perf/*.perf-spec.ts | wc -l` = **62**, `ls test/perf/*read* | wc -l` = **51**.
- [ ] `docs/PLAN.md` `142 행` 의 "실 DB round-trip 실측이 **slice 27 까지 도달**" 이 **slice 28 까지 도달** 로 바뀌고, slice 28 절(대상 route `GET /api` · spec 파일명 · T-1555 · main `4f444198` · it **11** 개 · 위 고유 대상 ①~③ 요지)이 기존 slice 나열 말미에 이어 붙는다.
- [ ] `docs/ops/load-resilience-test-plan.md` `§ 5` item 5 머리말의 "slice 27 까지 도달" 이 "slice 28 까지 도달" 로 바뀌고, slice 28 절이 slice 27 절 뒤에 이어 붙는다 (baseline 확정 축 **네 번째 route** · DB 미접촉 하한 대조 기준선 · guard 미적용 negative 정반대 명시).
- [ ] `docs/ops/load-resilience-test-plan.md` 의 인벤토리 오독 차단 단락(`648 행` 부근)에 slice 28 절이 추가되고, "**규모 축 slice 가 아니다**"(seed 불요 DB 미접촉 route) 가 명시돼 규모 축 **3 route** 서술이 4 로 오르지 않는다.
- [ ] `docs/requirements.md` `67 행` REQ-048 행 말미에 slice 28 서술이 추가되고, 계수 나열이 `*.perf-spec.ts` **62** · `*realdb*` **28** · `read` **51** · 실 DB read **21** 로 갱신되며 `51 − 21 = 30` 식이 보존된다. 검증: `ls test/perf/*realdb* | wc -l` = **28**, `ls test/perf/*read*realdb* | wc -l` = **21**.
- [ ] `read` glob 불변이 **일곱 번째 사례** 로 (여섯 번째 아님), 재분류 0 이 **6 연속** 으로 (5 연속 아님), baseline 확정 축이 **네 번째 route** 로 (세 번째 아님) 적힌다. 검증: 3 문서에서 `grep -n "일곱 번째\|6 연속\|네 번째 route"` 로 신규 문구 확인.
- [ ] **완료 선언 0 유지** — `docs/PLAN.md` `140 행` 성능 검증 checkbox 가 `[ ]` 그대로, REQ-048 판정이 `IN_PROGRESS` 그대로, 부하계획 `§ 5` item 5 가 미완 결론 그대로다. 검증: 세 지점 diff 에 checkbox/판정 토큰 변경이 없음.
- [ ] 도메인 **15** · 조회 route **31** · 인벤토리 (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** · 규모 축 **3 route** 서술이 전부 불변이다 (숫자 수정 0).
- [ ] `test/perf/README.md` · `test/perf/*.ts` · `src/` · `prisma/` · `.github/workflows/` 수정 **0**. 검증: `git status --porcelain` 결과가 위 `touchesFiles` 3 개뿐.
- [ ] 변경 규모가 cap 이내다 (≤ 300 LOC · ≤ 5 파일). 검증: `git diff --stat`.
- [ ] 신규 서술의 행 범위 표기가 CLAUDE.md `§12` 범위 좌표 규약을 따른다 (`~` 구분자 · `L` prefix 금지 · 단일 행은 `142 행`).
- [ ] 문서 본문은 한국어, 경로·식별자·glob 은 영어 그대로다 (CLAUDE.md `§12`).

**R-110 면제 근거** — 본 task 는 코드 변경 0 의 `direct` doc-only 라 tester 미호출이 규정상 허용된다
(CLAUDE.md `§3.2` R-110 단서). 대신 위 glob 4 종(62/51/28/21) 실측과 `git diff --stat` 검산으로
대체한다. R-112 4 항목(happy / error / 분기 / negative)은 production code 변경이 없어 **적용 대상
아님** — 해당 test 는 T-1555 가 이미 it 11 개(happy 2 · 분기 2 · error 2 · negative 5)로 박제했다.

## Out of Scope

- **`test/perf/README.md` 수정** — 계수 정본은 T-1555 가 이미 slice 28 bullet 을 박제했다. 본 task 는 인용만 한다 (수정 시 `§3.1` direct·pr mixed 발생).
- **`test/perf/*.ts` spec 수정 · 신규 slice 배선 · mock 짝 / slice 22 retire** — 코드 변경 0. retire 판단은 T-1536 이 명시 유보했다.
- **완료 선언** — PLAN `140 행` checkbox 체크 · REQ-048 `DONE` 전환 · 부하계획 item 5 완료 표기 금지. 잔여 4 축(체크인 baseline · CI job 편입 · 임계 fix · 시각화(web) 렌더 측정)은 그대로 존속한다.
- **REQ-047 실 scale 부하 주장** — 본 slice 는 seed 조차 불요한 소규모 표본이다. 그렇게 읽힐 표현 금지.
- **wall-clock 대소 · `comparison.regressed` 단언** — 어떤 값끼리도 대소를 단언하지 않는다 (관찰 기록만).
- **다른 REQ 행 · 다른 PLAN bullet · ADR status flip · 새 dependency · 행 좌표 표기 소급 정규화**.
- **`docs/STATE.json` · journal 편집** — driver 의 bookkeeping 몫 (STATE single-writer, `§9`).

## Suggested Sub-agents

`implementer` 단독 (architect 불요 — 새 결정 0. tester 는 R-110 면제로 미호출).

## Follow-ups

- **baseline 확정 축의 다음 단계 판정** (T-1555 이월) — measure→confirm mock 4 개가 전부 실 DB 짝을 가진 시점이므로, (c) 축의 다음 진전이 "repo 체크인 baseline + CI job 편입 + 임계 fix"(부하계획 `§ 5` #4 · #5) 인지 다섯 번째 route 인지를 planner 가 판단할 시점이다.
- **인벤토리 머리말 갱신 조건 박제** (T-1546 → T-1554 → 본 task 이월) — 재분류 0 slice 가 7 연속이 되면 "재분류 0 이 N 연속" 문형 누적 대신 머리말을 한 번 재작성할 조건을 정할 것.
