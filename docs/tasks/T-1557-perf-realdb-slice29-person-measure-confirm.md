---
id: T-1557
title: 실 DB perf slice 29 — GET /api/persons measure→confirm baseline 을 guard 미부착 + DB 접촉 route 위에 배선
phase: P5
status: DONE
completedAt: 2026-08-10T18:54:37Z
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-10
createdAt: 2026-08-10T17:20:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1555, T-1556]
touchesFiles:
  - test/perf/person-measure-confirm-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 성능 검증 bullet — baseline 확정 축 다섯 번째 route(guard 미부착 + DB 접촉 · soft-delete 필터), read glob 불변 8 번째 · 재분류 0 7 연속"
---

# T-1557 — 실 DB perf slice 29 (`GET /api/persons` measure→confirm baseline loop)

## Why

[PLAN.md](../PLAN.md) `140 행` 의 성능 검증 bullet(REQ-048) 은 아직 `[ ]` 이고, 그 잔여 4 축 중
**(c) baseline 확정 축** 은 slice 25(`GET /api/summaries`) · 26(`GET /api/assessments`) ·
27(`GET /api/contributions`) · 28(`GET /api`) 네 route 를 태운 상태다. T-1555 Follow-ups 가 planner
에게 넘긴 판정 — "다음 진전이 체크인 baseline + CI job 편입인가, 다섯 번째 route 인가" — 에 대해
본 task 는 **다섯 번째 route** 를 택한다. 근거: 체크인 baseline + CI job 편입은 `.github/workflows/`
+ 체크인 JSON + 임계 fix 가 한 덩어리로 얽혀 cap(300 LOC / 5 파일) 안에 들어가지 않고 CI flaky
risk 를 동반하므로, 그 축은 별도 ADR 선행 후 진입한다 (본 task Follow-ups 에 이월).

**고유 축 ① — guard 미부착 × DB 접촉 조합의 첫 baseline 확정 (2×2 격자의 마지막 칸).** slice 25 ~ 27
은 `JwtAuthGuard` 통과 + 실 Prisma round-trip 이었고, slice 28 은 guard 미부착 + **DB 미접촉**
(`GET /api`) 이었다. `PersonController` 는 guard 미부착이면서 `findActive()` 가 실 SELECT 를 발화하므로,
본 slice 의 baseline 은 **인증 layer 노이즈 0 인 상태의 순수 DB 왕복 몫** 을 담는다 — slice 28 의
framework-only 하한과 나란히 두면 "얼마가 DB 몫인가" 를 처음으로 같은 harness 위에서 대조할 수 있다.

**고유 축 ② — soft-delete 필터가 결과 집합을 좁히는 route 위의 첫 measure→confirm.**
`findActive()` 는 `active: true`(REQ-026) 만 반환하므로 inactive row 를 섞어 seed 하면 응답 길이가
**active row 수와 정확히 일치** 해야 한다. established / compared 두 국면 모두에서 그 일치가 성립함이
실 query 발화의 증거다 (slice 25 ~ 27 의 "응답 길이 = seed row 수" 보다 한 단계 강한 필터 대조).

**고유 축 ③ — mock measure→confirm 짝이 없는 첫 실 DB baseline 확정.** slice 25 ~ 28 은 각각 mock
measure→confirm 짝(T-0877 · T-0880 · assessment · contribution)을 가진 route 였다. `GET /api/persons`
의 기존 perf-spec 은 `person-read.perf-spec.ts`(collector 배선) · `person-read-realdb.perf-spec.ts`
(slice 1, 관찰 전용) · `person-list-scale-realdb.perf-spec.ts`(slice 23, 규모 축) 뿐이라 **top loop 을
태운 판본이 mock 에도 실 DB 에도 없다**. 이는 T-1555 가 남긴 "measure→confirm mock 4 개가 전부 실 DB
짝을 가진 것은 축의 소진이 아니다" 를 기계적으로 실증한다 — 축은 mock 짝 개수에 종속되지 않는다.

**계수 함정 ① — `read` glob 두 개 다 불변 (여덟 번째 사례).** 신규 파일명
`person-measure-confirm-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 · 23 · 24 · 25 · 26 ·
27 · 28 에 이은 **여덟 번째**). `*read*` **51 불변** · `*read*realdb*` **21 불변** 이고 계산식
`51 − 21 = 30` 이 식도 결과도 그대로다. 늘어나는 것은 `*.perf-spec.ts` **62 → 63** 과 `*realdb*`
**28 → 29** 뿐이다. T-1555 가 쓴 "**일곱 번째**" 문형을 복사하면 틀린다.

**계수 함정 ② — 재분류 0 이 7 연속.** 대상 `GET /api/persons` 는 slice 1 · 23 이 이미 실측한 route 라
도메인 **15** · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** 이 전부
불변이다. **규모 축도 3 route 불변** — 본 slice 는 measure→confirm harness 축이지 규모 축이 아니다
(slice 23 이 같은 route 의 규모 축을 이미 태웠으므로 규모 대조를 다시 만들지 않는다).

**계수 함정 ③ — 완료 선언 0.** baseline 은 여전히 **임시 디렉토리 1 회성** 이고 체크인 기준
baseline(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 전부 미착수다. 잔여 4 축이 그대로 존속한다.

## Required Reading

- [test/perf/app-root-measure-confirm-realdb.perf-spec.ts](../../test/perf/app-root-measure-confirm-realdb.perf-spec.ts)
  — 직전 slice 28 의 **guard 미부착 판본 골격**. `beforeEach`(`fs.mkdtempSync`) / `afterEach`
  (`fs.rmSync` + `truncateAll`) / `afterAll` 골격, `dirOf` helper, `ITER = { iterations: 4 }`,
  무-cookie · 변조 토큰 200 negative 문형을 승계한다. **수정 금지**.
- [test/perf/summary-measure-confirm-realdb.perf-spec.ts](../../test/perf/summary-measure-confirm-realdb.perf-spec.ts)
  — slice 25 의 **DB 접촉 판본**. seed → 응답 길이 대조로 실 query 발화를 입증하는 방식과
  `ConfirmOrCompareResult` 판별 union 사용법을 참고한다. **수정 금지**.
- [test/perf/person-read-realdb.perf-spec.ts](../../test/perf/person-read-realdb.perf-spec.ts)
  — 같은 route(slice 1) 의 실 DB 배선. `createE2EApp()` 부트스트랩(인증 helper 불요) ·
  `moduleRef.get(PrismaService)` seed · `person.createMany` 패턴 · 404 로 errorRate 를 만드는 방식을
  참고한다. **수정 금지** (본 slice 는 대체가 아니라 상위 loop 배선).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) 의
  `measureAndConfirmBaseline(request, env, baseDir, opts)` 시그니처와 `MeasureAndConfirmOpts` —
  재구현 0, 호출만 한다.
- [test/perf/README.md](../../test/perf/README.md) `1074 행` 의 **slice 28** bullet 과 `1103 행` 의
  **잔여** bullet — 본 task 가 갱신할 **계수 정본**.
- [docs/tasks/T-1555-perf-realdb-slice28-app-root-measure-confirm.md](T-1555-perf-realdb-slice28-app-root-measure-confirm.md)
  — 직전 선례이자 Acceptance Criteria 문체 mirror. 단 **"일곱 번째" · "6 연속" · "네 번째 route" ·
  "DB 미접촉 floor" 는 복사 금지** (본 task 는 각각 **여덟 번째** · **7 연속** · **다섯 번째 route** ·
  **guard 미부착 + DB 접촉** 이다).

## Acceptance Criteria

- [ ] `test/perf/person-measure-confirm-realdb.perf-spec.ts` 신규 생성 — mock(`useValue`) **0** ·
  `overrideGuard` **0** 이고 실 `AppModule` 을 `createE2EApp()` 로 부트스트랩한다
  (`grep -c "useValue\|overrideGuard"` 결과 **0**).
- [ ] **happy path ①(established)** — baseline 부재 상태에서 `measureAndConfirmBaseline` 이 최초 확정
  write 를 수행하고 그 파일이 실제로 생성됨을 `fs.existsSync` 로 단언하는 test 1+. 같은 test 에서
  응답이 **200 + 길이 == active seed row 수** 임을 단언한다.
- [ ] **happy path ②(compared)** — 같은 label 로 재실행 시 로드 · 비교 국면(`ConfirmOrCompareResult`
  의 compared 형태)에 도달함을 단언하는 test 1+. **`comparison.regressed` 값과 wall-clock 대소는
  단언하지 않는다** (관찰 기록만 — T-0877/T-0880 flaky 사고 재발 차단).
- [ ] **분기 cover — soft-delete 필터 대조 (고유 축 ②)** — active row 와 inactive row 를 **서로 다른
  개수** 로 섞어 seed 한 뒤, established · compared **두 국면 모두** 에서 응답 길이가 **active 수와
  정확히 일치**(inactive 는 0 건 노출) 함을 단언하는 test 를 둔다. 국면 분기 판정 자체는 baseline
  파일 존재 여부라 latency 값에 의존하지 않는다.
- [ ] **error path 2+** — (a) 공백-only `baseDir` 로 호출 시 `RangeError` 가 던져지고 **그 시점 파일
  생성이 0** 임(순서 계약의 write 부작용 0)을 함께 단언, (b) 손상된 baseline JSON 을 심어 둔 뒤
  `SyntaxError` 가 나는 것을 단언.
- [ ] **negative cases 5 종 충분 cover** — (a) cookie **미부착** → 401 이 아니라 **200** 이고 표본이
  정상 수집됨(guard 미부착 — slice 25 ~ 27 과 정반대, 단 slice 28 과 달리 DB 를 탄다), (b) **변조
  토큰 쿠키** 부착 → 401/403 이 아니라 **200** 이고 응답 길이 불변, (c) 전량 inactive seed →
  **200 + `[]`**(404 아님 — soft-delete 필터가 전량 배제), (d) 존재하지 않는 id 의
  `GET /api/persons/:id` 반복 → 전부 **404**(500 아님) · 성공 표본 **0** · `errorRate = 1`, 200 과
  섞으면 `0 < errorRate < 1`, (e) `truncateAll` **직후** 재측정 → 목록이 **빈 배열** 인데도 compared
  국면 도달 + 200 유지(빈 결과 집합이 국면 도달을 막지 않음).
- [ ] **임계 검증** — 기본 표본은 p95 **< 3000ms**(REQ-048) 로 pass 하고, `p95MaxMs: 0` 을 인위 주입한
  표본은 **fail** 로 판정되는 test 1+. `DEFAULT_P95_MAX_MS = 3000` 자체는 **변경하지 않는다**.
- [ ] **저장소 오염 0** — baseline 은 `os.tmpdir()` 하위 test 별 임시 디렉토리에만 쓰고 `afterEach`
  에서 재귀 삭제한다. spec 실행 후 `git status --porcelain` 에 신규 산출물이 없다.
- [ ] `test/perf/README.md` 갱신 — **slice 29** bullet 신규 + **잔여** 절 계수 갱신:
  `*.perf-spec.ts` **62 → 63** · `*realdb*` **28 → 29** · `*read*` **51 불변**(**여덟 번째** 사례) ·
  `*read*realdb*` **21 불변** · 도메인 **15** · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** ·
  mock 잔존 **30** · 규모 축 **3 route** 전부 불변, 재분류 0 이 **7 연속**. 계수는
  `ls test/perf/*.perf-spec.ts | wc -l` 등 **glob 실측** 으로 검산한다 (추정 금지).
- [ ] **완료 선언 0 유지 (계수 함정 ③)** — README 에 "baseline 확정 축이 다섯 route 에 도달" 을 적더라도
  **같은 자리에 소진 아님을 병기** 한다 (임시 디렉토리 1 회성 · 체크인 기준 baseline · CI job 편입 ·
  임계 fix 미착수 · 잔여 4 축 존속). `[x]` 전환 · REQ status flip · "성능 검증 완료" · "(c) 축 해소"
  로 읽히는 표현 **금지**.
- [ ] 명령 검증 — `pnpm lint && pnpm build` 통과, 신규 spec 이 `pnpm test:perf` 에서 통과,
  `pnpm test:cov` 가 **line ≥ 80% / function ≥ 80%** 를 유지 (production code 변경 0 이라 하락 없음).
- [ ] **cap 준수** — 변경 **2 파일**, 총 diff **≤ 300 LOC** (신규 spec 은 **≤ 255 LOC** 목표 —
  `it(` 는 **9 ~ 11 개** 로 억제하고 주석은 slice 25 · 28 을 cross-ref 로 인용해 복제하지 않는다).

## Out of Scope

- **PLAN · 부하계획 · REQ-048 3 문서 갱신** — [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3 (direct · pr
  mixed 금지) 에 따라 **머지 후 별도 `direct` doc-sync task** 로 이월한다 (T-1552 · T-1554 · T-1556
  선례). 본 task 는 `test/perf/README.md` 만 갱신한다.
- **repo 체크인 baseline JSON 확정 · CI job 편입 · workflow 편집 · 임계 fix** — 부하계획 `§ 5` #4 · #5
  잔여는 본 slice 로 해소되지 않으며 별도 ADR 선행 task 다. `jest-perf.json` 의 기존 `testRegex` 가
  신규 spec 을 자동 picking 하므로 `.github/workflows/` 편집 **불요**.
- **기존 person perf-spec 수정 · 삭제 · 통합** — `person-read.perf-spec.ts`(T-0833) ·
  `person-read-realdb.perf-spec.ts`(slice 1) · `person-list-scale-realdb.perf-spec.ts`(slice 23) 를
  건드리지 않는다. 대체가 아니라 보완이며 retire 판단은 T-1536 이 명시 유보했다.
- **production code · schema · 임계값 변경** — `src/` · `prisma/` 무수정,
  `DEFAULT_P95_MAX_MS = 3000` 불변. `PersonService.findActive` 의 성능 개선 제안도 적지 않는다.
- **collector · io · baseline 모듈(`.ts`) 수정** — `measureAndConfirmBaseline` 등은 import · 호출만
  한다 (재구현 0).
- **규모 축 확장** — slice 23 이 이미 태운 `GET /api/persons` 의 규모 대조(소/대 표본)를 다시 만들지
  않는다. 규모 축 계수는 **3 route 불변** 이다.
- **다른 endpoint 배선 · write / trigger route perf · 병렬 동시성 request · web 렌더 측정.**
- **REQ-047 실 scale 부하 주장** — 본 slice 는 상대 비교용 소규모 표본이며 실 scale 부하 검증이
  아니다. 그렇게 읽히는 표현을 spec 주석 · README 어디에도 쓰지 않는다.
- **wall-clock 대소 · `comparison.regressed` 단언** — 어떤 값끼리도 대소를 단언하지 않는다.
- **행 좌표 표기 소급 정규화** · **ADR status flip** · **새 dependency 도입**.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 harness 재사용).

## Follow-ups

- **slice 29 doc-sync (direct)** — PLAN `142 행` 계수(perf-spec 63 · 실 DB 29) · 부하계획 `§ 5` item 5 ·
  REQ-048 재판정을 머지 후 별도 direct task 로 이월 (본 task Out of Scope).
- **체크인 baseline + CI job 편입 축의 ADR 선행** (T-1555 Follow-ups 판정 결과) — 부하계획 `§ 5` #4 · #5
  는 workflow 편집 + 체크인 JSON + 임계 fix + flaky 정책이 한 덩어리라 cap 을 넘는다. 진입 전
  **ADR 1 개**(baseline 저장 위치 · 갱신 주체 · 회귀 판정 시 CI fail 여부)로 결정을 먼저 박제할 것.
- **인벤토리 머리말 갱신 조건 박제** (T-1546 → T-1554 → T-1555 이월) — 재분류 0 slice 가 7 연속이 되며
  근거가 더 두터워졌다.

## Result (2026-08-10T18:54Z)

- **DONE** — `pr` mode PR **#1239** squash merge (`b77e944e`, main). 변경 **2 파일 `+292/-7`**
  (cap `300 LOC / 5 파일` 이내): `test/perf/person-measure-confirm-realdb.perf-spec.ts` 신규 255 LOC
  (`it` 11 개), `test/perf/README.md` slice 29 bullet + 잔여 절 계수 갱신.
- baseline 확정 축의 **다섯 번째 route** = `GET /api/persons` — guard 미부착 + DB 접촉(soft-delete
  필터) 조합. mock **0** · `overrideGuard` **0** 으로 `createE2EApp` 부트스트랩해 실 Postgres 왕복만 계측.
- AC 12 항목 전부 ok — happy 2 국면(established 확정 write / compared 도달), soft-delete 두 국면 분기
  대조, error path 2 종(`RangeError` · `SyntaxError`), negative 5 종, 임계 검증(기본 pass ·
  `p95MaxMs=0` fail), 저장소 오염 0(tmpdir 1 회성 + `afterEach` 재귀 삭제).
- 4-게이트 충족 — reviewer `VERDICT: APPROVE` PR comment 외화(round 1) + integrator 자체 점검 +
  PR CI **2 job 전부 pass**(기본 검사 / 배포 산출물 검증) + merge. `pnpm lint · build · test:cov`
  통과(429 suite / 12302 test, line·function ≥ 80% 유지).
- **완료 선언 0 유지** — PLAN `140 행` `[ ]` · REQ-048 `IN_PROGRESS` 보존. 계수 doc-sync 는
  Follow-ups 의 별도 direct task 로 이월(`§3.1` rule 3 — direct·pr mixed 금지).
- CI: main run(`b77e944e`) 은 turn 종료 시점 **in_progress** → 다음 fire 가 conclusion 재확인(R-114 위임).
