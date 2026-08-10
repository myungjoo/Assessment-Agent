---
id: T-1555
title: 실 DB perf slice 28 — GET /api(app root) measure→confirm baseline loop 을 실 AppModule 부트스트랩 위에 배선
phase: P5
status: DONE
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-10
createdAt: 2026-08-10T13:05:00Z
completedAt: 2026-08-10T14:51:27Z
prNumber: 1238
independentStream: perf-realdb-slices
dependsOn: [T-1553, T-1554]
touchesFiles:
  - test/perf/app-root-measure-confirm-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "P5 성능 검증 bullet — baseline 확정 축 네 번째 route(DB 미접촉 floor · guard 미적용), read glob 불변 7 번째 · 재분류 0 6 연속"
---

# T-1555 — 실 DB perf slice 28 (`GET /api` measure→confirm baseline loop)

## Why

[PLAN.md](../PLAN.md) `140 행` 의 성능 검증 bullet(REQ-048) 은 아직 `[ ]` 이고, 그 잔여 4 축 중
**(c) baseline 확정 축** 은 slice 25(`GET /api/summaries`, T-1549) · slice 26(`GET /api/assessments`,
T-1551) · slice 27(`GET /api/contributions`, T-1553) 세 route 만 태운 상태다. 본 task 는 그 축의
**네 번째 route** 로 `AppController` 의 root health read `GET /api` 를 태운다.

**고유 축 ① — DB 미접촉 route 위의 첫 baseline 확정이다.** slice 25 ~ 27 의 표본은 전부 요청 경로가
실 Prisma round-trip 을 최소 1 회 수행했다. 반면 `getRoot()` 는 `AppService.getStatus()` 의 고정 상수
`APP_STATUS_MESSAGE` 를 동기 반환할 뿐이라, 실 `AppModule` + 실 Prisma 연결이 살아 있어도 요청 경로는
DB 를 **전혀 건드리지 않는다**. 따라서 established / compared 두 국면에 기록되는 baseline 은
**framework + HTTP 왕복만의 하한** 이고, 앞 세 route 의 baseline 을 읽을 때 "얼마가 DB 몫인가" 를
가늠할 대조 기준선이 된다. slice 22(`app-root-read-realdb.perf-spec.ts`, T-1543) 가 같은 route 를
**collector 개별 배선** 으로만 쟀던 것과 달리, 본 slice 는 그 위의 **top loop
`measureAndConfirmBaseline` + 실 fs baseline round-trip** 을 처음으로 태운다.

**고유 축 ② — guard layer 가 없는 첫 measure→confirm 실 DB slice 다.** slice 25 ~ 27 은 모두
`JwtAuthGuard` 통과가 전제라 negative (c) 가 "cookie 미부착 → 401" 이었다. `AppController` 는 guard
미적용이라 **인증 없이 200**, 변조 쿠키를 붙여도 401 이 아니며 User tier actor 도 403 이 아니다 —
앞 세 slice 와 **정반대의 negative** 를 실 부트스트랩 위에서 실증한다.

이로써 measure→confirm mock spec **4 개(summary · assessment · contribution · app-root) 전부** 가 실 DB
짝을 갖는다. 단 그 사실은 **축의 소진이 아니다** (아래 계수 함정 ④).

**계수 함정 ① — `read` glob 두 개 다 불변 (일곱 번째 사례).** 신규 파일명
`app-root-measure-confirm-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 · 23 · 24 · 25 · 26 ·
27 에 이은 **일곱 번째**). `*read*` **51 불변** · `*read*realdb*` **21 불변** 이고 계산식
`read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 늘어나는 것은 `*.perf-spec.ts`
**61 → 62** 와 `*realdb*` **27 → 28** 뿐이다. T-1553 이 쓴 "**여섯 번째** 사례" 문형은 복사하면 틀린다.

**계수 함정 ② — 재분류 0 이 6 연속.** 대상 `GET /api` 는 **slice 22 가 이미 실측한 route** 이므로
도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30 불변** · (B) **0 불변** · (C) **0 불변**
· mock 잔존 **30 불변** 이다. T-1553 의 "5 연속" 문형은 복사하면 틀린다.

**계수 함정 ③ — 규모 축은 3 route 그대로.** 본 slice 는 규모 축이 아니다 (seed 자체가 불요한 DB 미접촉
route). 규모 축 **3 route** 서술을 4 로 올리지 않는다.

**계수 함정 ④ — 완료 선언 0 (최대 함정).** "measure→confirm mock 4 개가 전부 실 DB 짝을 가졌다" 는
사실이 "(c) 축 해소" 로 읽힐 위험이 가장 큰 slice 다. 그러나 본 slice 의 baseline 도 **임시 디렉토리
1 회성** 이고 **repo 체크인 기준 baseline(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix 는 전부 미착수**
다. 잔여 4 축 — (a) (A) 부류 mock spec 30 개 retire 판단, (b) 다른 endpoint 규모 민감도, (c) baseline
확정 · 임계 fix, (d) web 렌더 측정 + REQ-047 실 scale 부하 — 이 **넷 다 그대로** 다.

**wall-clock 대소 단언 금지 (사고 이력).** T-0877 이 `app-root-measure-confirm.perf-spec.ts` 에서
wall-clock 대소를 단언해 T-0880 의 PR CI 를 2 회 연속 red 로 만든 이력이 있다. "floor 이므로 더 빠르다"
류 단언의 유혹이 본 slice 에서 구조적으로 크므로 **어떤 값끼리도 대소를 단언하지 않는다** —
`comparison.regressed` 값도 단언하지 않는다 (관찰 기록만).

## Required Reading

- [test/perf/contribution-measure-confirm-realdb.perf-spec.ts](../../test/perf/contribution-measure-confirm-realdb.perf-spec.ts)
  — 직전 slice 27 의 **구조 mirror 정본**. import 목록(`createAuthenticatedE2EApp` ·
  `buildAuthCookie` · `AuthenticatedE2EContext` · `truncateAll` · `reseedAuthenticatedActors` ·
  `measureAndConfirmBaseline` · `BaselineEnvMeta`), `beforeAll` / `beforeEach`(`fs.mkdtempSync`) /
  `afterEach`(`fs.rmSync` + `truncateAll` + actor 재-seed) / `afterAll` 골격, `dirOf` helper,
  `ITER = { iterations: 4 }` 를 그대로 승계한다. **수정 금지**.
- [test/perf/app-root-read-realdb.perf-spec.ts](../../test/perf/app-root-read-realdb.perf-spec.ts)
  — 같은 route(slice 22) 의 실 DB 배선. `APP_STATUS_MESSAGE` 상수 단언 방식, guard 미적용 negative
  3 종(무-cookie 200 · 변조 토큰 200 · User tier 200), truncate 전/후 불변 검증, 인접 미매칭 경로
  404 패턴을 참고한다. **수정 금지** (본 slice 는 대체가 아니라 상위 loop 배선).
- [test/perf/app-root-measure-confirm.perf-spec.ts](../../test/perf/app-root-measure-confirm.perf-spec.ts)
  — 본 slice 의 **mock 짝**(T-0877). `AppService` 를 `useValue` mock 으로 주입한 판본이며 본 slice 는
  **mock override 0** 이라는 점이 결정적 차이다. **수정 · 삭제 금지** (retire 판단은 T-1536 유보).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) 의
  `measureAndConfirmBaseline` 시그니처와 `ConfirmOrCompareResult` 판별 union — 재구현 0, 호출만 한다.
- [test/perf/README.md](../../test/perf/README.md) `1053 행` 부근 **slice 27** bullet 과 그 뒤 **잔여**
  bullet — 본 task 가 갱신할 **계수 정본**.
- [docs/tasks/T-1553-perf-realdb-slice27-contribution-measure-confirm.md](T-1553-perf-realdb-slice27-contribution-measure-confirm.md)
  — 직전 선례이자 Acceptance Criteria 문체 mirror. 단 **"여섯 번째" · "5 연속" · "세 번째 route" ·
  3-level FK chain 축은 복사 금지** (본 task 는 각각 일곱 번째 · 6 연속 · **네 번째 route** ·
  **DB 미접촉 floor** 다).

## Acceptance Criteria

- [ ] `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` 신규 생성 — mock(`useValue`) **0** ·
  `overrideGuard` **0** 이고 실 `AppModule` 을 `createAuthenticatedE2EApp` 로 부트스트랩한다
  (`grep -c "useValue\|overrideGuard"` 결과 **0**).
- [ ] **happy path ①(established)** — baseline 부재 상태에서 `measureAndConfirmBaseline` 이 최초 확정
  write 를 수행하고 그 baseline 파일이 실제로 생성됨을 `fs.existsSync` 로 단언하는 test 1+. 응답은
  매번 **200 + `APP_STATUS_MESSAGE` 상수 문자열** 이고 표본 수 == 반복 수임을 함께 단언한다.
- [ ] **happy path ②(compared)** — 같은 label 로 재실행 시 로드 · 비교 국면(`ConfirmOrCompareResult`
  의 compared 형태)에 도달함을 단언하는 test 1+. **`comparison.regressed` 값과 wall-clock 대소는
  단언하지 않는다** (관찰 기록만 — T-0877/T-0880 flaky 사고 재발 차단).
- [ ] **분기 cover — DB 미접촉 실증 (본 slice 고유 축 ①)** — `truncateAll` 로 DB 를 전량 비운 **전 / 후**
  양쪽에서 established · compared **두 국면 모두** 를 태우고, 응답 status 와 상수 문자열이 **불변**
  임을 단언하는 test 를 둔다 (DB 상태가 응답 · 국면 도달에 영향을 주지 않음 = DB 미접촉의 증거).
  분기 판정 자체는 baseline 파일 존재 여부로 결정론적이며 latency 값에 의존하지 않는다.
- [ ] **error path 2+** — (a) 공백-only `baseDir` 로 호출 시 `RangeError` 가 던져지고 **그 시점 파일
  생성이 0** 임(순서 계약의 write 부작용 0)을 함께 단언, (b) 손상된 baseline JSON 을 심어 둔 뒤
  `SyntaxError` 가 나는 것을 단언.
- [ ] **negative cases 5 종 충분 cover** — (a) cookie **미부착** → 401 이 아니라 **200** 이고 표본이
  정상 수집됨(앞 세 slice 와 정반대 — 고유 축 ②), (b) **변조 토큰 쿠키** 부착 → 401/403 이 아니라
  **200**, (c) 인접 **미매칭 경로** 반복 조회 → 전부 **404**(500 아님) · 성공 표본 **0** · raw stack ·
  내부 경로 미노출, (d) 인위 non-2xx 전량 주입 시 `errorRate = 1` · 200 혼합 시 `0 < errorRate < 1`,
  (e) `POST /api` → 405 가 아니라 **404** 로 수렴하고 500 이 아님.
- [ ] **임계 검증** — 기본 표본은 p95 **< 3000ms**(REQ-048) 로 pass 하고, `p95MaxMs: 0` 을 인위 주입한
  표본은 **fail** 로 판정되는 test 1+. `DEFAULT_P95_MAX_MS = 3000` 자체는 **변경하지 않는다**.
- [ ] **저장소 오염 0** — baseline 은 `os.tmpdir()` 하위 test 별 임시 디렉토리에만 쓰고 `afterEach`
  에서 재귀 삭제한다. spec 실행 후 `git status --porcelain` 에 신규 산출물이 없다. `afterEach` 의
  `truncateAll` 뒤 actor User 를 **원본 id 그대로** 재-seed 한다 (FK 전제 복원).
- [ ] `test/perf/README.md` 갱신 — **slice 28** bullet 신규 + **잔여** 절 계수 갱신:
  `*.perf-spec.ts` **61 → 62** · `*realdb*` **27 → 28** · `*read*` **51 불변**(**일곱 번째** 사례) ·
  `*read*realdb*` **21 불변** · 도메인 **15** · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** ·
  mock 잔존 **30** · 규모 축 **3 route** 전부 불변, 재분류 0 이 **6 연속**. 계수는
  `ls test/perf/*.perf-spec.ts | wc -l` 등 **glob 실측** 으로 검산한다 (추정 금지).
- [ ] **완료 선언 0 유지 (계수 함정 ④)** — README 에 "measure→confirm mock 4 개가 전부 실 DB 짝을
  가졌다" 를 적더라도 **같은 자리에 소진 아님을 병기** 한다 (baseline 은 임시 디렉토리 1 회성 ·
  체크인 기준 baseline · CI job 편입 · 임계 fix 미착수 · 잔여 4 축 존속). `[x]` 전환 · REQ status
  flip · "성능 검증 완료" · "(c) 축 해소" 로 읽히는 표현 **금지**.
- [ ] 명령 검증 — `pnpm lint && pnpm build` 통과, 신규 spec 이 `pnpm test:perf` 에서 통과,
  `pnpm test:cov` 가 **line ≥ 80% / function ≥ 80%** 를 유지 (production code 변경 0 이라 하락 없음).
- [ ] **cap 준수** — 변경 **2 파일**, 총 diff **≤ 300 LOC** (신규 spec 은 **≤ 255 LOC** 목표 —
  slice 25 · 26 · 27 이 `+300` · `+299` · `+300` 으로 경계에 붙었던 선례를 반복하지 않는다.
  `it(` 는 **9 ~ 11 개** 로 억제하고 주석은 slice 27 을 cross-ref 로 인용해 복제하지 않는다).

## Out of Scope

- **PLAN · 부하계획 · REQ-048 3 문서 갱신** — [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3 (direct · pr
  mixed 금지) 에 따라 **머지 후 별도 `direct` doc-sync task** 로 이월한다 (T-1550 · T-1552 · T-1554 선례).
  본 task 는 `test/perf/README.md` 만 갱신한다.
- **mock 짝 · slice 22 spec 수정 · 삭제 · 통합** — `app-root-measure-confirm.perf-spec.ts`(T-0877) ·
  `app-root-read.perf-spec.ts`(T-0859) · `app-root-read-realdb.perf-spec.ts`(T-1543) 를 건드리지 않는다.
  대체가 아니라 보완이며 retire 판단은 T-1536 이 명시 유보했다.
- **production code · schema · 임계값 변경** — `src/` · `prisma/` 무수정, `DEFAULT_P95_MAX_MS = 3000`
  불변. `AppService` · `AppController` 의 성능 개선 제안도 적지 않는다.
- **repo 체크인 baseline JSON 확정 · CI job 편입 · workflow 편집** — 부하계획 `§ 5` #4 · #5 잔여는 본
  slice 로 해소되지 않는다. `jest-perf.json` 의 기존 `testRegex` 가 신규 spec 을 자동 picking 하므로
  `.github/workflows/` 편집 **불요**.
- **collector · io · baseline 모듈(`.ts`) 수정** — `measureAndConfirmBaseline` 등은 import · 호출만
  한다 (재구현 0).
- **규모 축 확장 · 다른 endpoint 배선 · write / trigger route perf · 병렬 동시성 request** — 본 slice 는
  규모 축이 아니고 route 도 1 개(`GET /api`) 뿐이다.
- **REQ-047 실 scale 부하 주장** — 본 slice 는 seed 조차 불요한 소규모 표본이며 실 scale 부하 검증이
  아니다. 그렇게 읽히는 표현을 spec 주석 · README 어디에도 쓰지 않는다.
- **wall-clock 대소 · `comparison.regressed` 단언** — 어떤 값끼리도(같은 spec 안 두 구간 · 다른 slice ·
  다른 route) 대소를 단언하지 않는다.
- **행 좌표 표기 소급 정규화** · **ADR status flip** · **새 dependency 도입**.

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 harness 재사용).

## Follow-ups

- **slice 28 doc-sync (direct)** — PLAN `142 행` 계수(perf-spec 62 · 실 DB 28) · 부하계획 `§ 5` item 5 ·
  REQ-048 재판정을 머지 후 별도 direct task 로 이월 (본 task Out of Scope).
- **baseline 확정 축의 다음 단계 판정** — measure→confirm mock 4 개가 전부 실 DB 짝을 가진 시점이므로,
  (c) 축의 다음 진전이 "repo 체크인 baseline + CI job 편입 + 임계 fix" 인지 다섯 번째 route 인지를
  planner 가 판단할 시점이 됐다.
- **인벤토리 머리말 갱신 조건 박제** (T-1546 → T-1554 이월) — 재분류 0 slice 가 6 연속이 되며 근거가
  더 두터워졌다.

## 결과 (2026-08-10T14:51:27Z DONE)

- PR **#1238** squash-merged (`4f444198`, branch 삭제). reviewer round **1** VERDICT `APPROVE` + PR comment 외화 + integrator self-check + PR CI green = 4-게이트 충족.
- 산출 **2 파일 `+288/-10`**(cap 이내): `test/perf/app-root-measure-confirm-realdb.perf-spec.ts` 신규(it **11** 개 — happy 2 · 분기 2 · error 2 · negative 5) + `test/perf/README.md` slice 28 bullet · 계수 갱신.
- mock(`useValue`) **0** · `overrideGuard` **0** 으로 실 `AppModule` 부트스트랩. baseline 은 임시 디렉토리 1 회성이라 저장소 오염 **0**.
- 계수 = perf-spec **61 → 62** · `*realdb*` **27 → 28**, `*read*` **51** · 실 DB read **21** 불변(일곱 번째) → 재분류 **0** 이 6 연속. 완료 선언 **0** 유지.
