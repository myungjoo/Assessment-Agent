---
id: T-1553
title: 실 DB perf slice 27 — measureAndConfirmBaseline 을 GET /api/contributions(3-level FK chain) 실 Postgres 에 배선
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 285
estimatedFiles: 2
created: 2026-08-10
createdAt: 2026-08-10T09:30:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1551]
touchesFiles:
  - test/perf/contribution-measure-confirm-realdb.perf-spec.ts
  - test/perf/README.md
plannerNote: "PLAN 142 행 잔여 축 (c) baseline 확정 세 번째 route — 부모 FK id 로 자식 컬렉션을 긁는 3-level chain 을 실 DB baseline 에 첫 배선, perf-spec 60 → 61"
---

# T-1553 — 실 DB perf slice 27 (`GET /api/contributions` measure→confirm baseline loop)

## Why

[PLAN.md](../PLAN.md) `140 행` "성능 검증" 의 `142 행` (R-92 조회 3 초) bullet 은 잔여 4 축
(REQ-047 실 scale 부하 · **baseline 확정** · 임계 fix · web 렌더 측정) 을 명시해 두고 있다. 그중
**baseline 확정 축** 은 [T-1549](T-1549-perf-realdb-slice25-summary-measure-confirm.md) (slice 25,
`GET /api/summaries`) 가 처음 열고 [T-1551](T-1551-perf-realdb-slice26-assessment-measure-confirm.md)
(slice 26, `GET /api/assessments`) 가 두 번째 route 를 태웠을 뿐이라 아직 소진되지 않았다
([test/perf/README.md](../../test/perf/README.md) 의 **잔여** 절이 그렇게 못 박고 있다).

본 slice 27 은 그 축의 **세 번째 route** 다. 대상은 `ContributionController`
`GET /api/contributions?assessmentId=<id>` ([src/user/contribution.controller.ts](../../src/user/contribution.controller.ts)
`86 행` 부근) 이며, mock 짝 [`contribution-measure-confirm.perf-spec.ts`](../../test/perf/contribution-measure-confirm.perf-spec.ts)
(T-0883) 와 **같은 harness · 다른 backend** 라 mock ↔ 실 DB **1:1 대조** 가 성립한다 (slice 25 ·
26 이 T-0880 · T-0882 짝에 대해 성립시킨 관계의 세 번째 사례). 이로써 measure→confirm mock spec
4 개 중 **평가-결과 read 표면 3 개** 가 모두 실 DB 짝을 갖게 된다.

**본 slice 고유 축 — 부모 FK id 로 자식 컬렉션을 긁는 3-level chain 의 첫 실 DB baseline 배선.**
slice 25 는 `personId` 단일 필수 param, slice 26 은 `personId` 필수 + `period` optional 이었고
둘 다 **조회 주체와 필터가 같은 level** 이었다. 본 route 는 `assessmentId`(= 부모 `Assessment` 의
id) 로 자식 `Contribution` 다중 row 를 긁는 **`Person → Assessment → Contribution` 3-level FK
chain** ([prisma/schema.prisma](../../prisma/schema.prisma) `329 행` `model Contribution`) 이라,
seed 비용과 join 경로가 앞 두 slice 와 다르다. 그 구조가 **실 query 지연을 포함한 표본** 에서
established(최초 확정 write) · compared(로드 · 비교) 양 국면에 도달하는지는 미관측이다 — T-0883 은
service `useValue` mock + `overrideGuard` 였고, 같은 route 를 실 DB 로 잰
[`contribution-read-realdb.perf-spec.ts`](../../test/perf/contribution-read-realdb.perf-spec.ts)
(slice 5) 는 **관찰 전용** 이라 baseline 을 디스크에 쓴 적이 없다.

**계수 함정 — `read` glob 두 개가 이번에도 불변 (여섯 번째 사례).** 신규 파일명
`contribution-measure-confirm-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 · 23 · 24 ·
25 · 26 에 이은 **여섯 번째**). 따라서 `*read*` **51 불변** · `*read*realdb*` **21 불변** 이고,
늘어나는 것은 `*.perf-spec.ts` **60 → 61** 과 `*realdb*` **26 → 27** 뿐이다. slice 26 이 쓴
"**다섯 번째** 사례" 문형을 복사하면 틀린다. 또한 같은 route 재측정이라 **재분류 0 이 5 연속**
이다 (도메인 15 · 조회 route 31 · 인벤토리 (A) 30 / (B) 0 / (C) 0 · mock 잔존 30 · 규모 축 3
route 전부 불변).

## Required Reading

- [test/perf/assessment-measure-confirm-realdb.perf-spec.ts](../../test/perf/assessment-measure-confirm-realdb.perf-spec.ts) — slice 26 원형. 본 spec 의 구조(임시 baseDir 격리 · 관찰 전용 기록 · error 2 종 · negative 5 종)를 그대로 따른다.
- [test/perf/contribution-measure-confirm.perf-spec.ts](../../test/perf/contribution-measure-confirm.perf-spec.ts) — mock 짝(T-0883). `assessmentId` 필수 분기 취지와 단언 목록을 승계하되 mock 은 승계하지 않는다.
- [test/perf/contribution-read-realdb.perf-spec.ts](../../test/perf/contribution-read-realdb.perf-spec.ts) — slice 5. `Person → Assessment → Contribution` 3-level seed 관용구 · 응답 형태 · 400 · 401 negative.
- [src/user/contribution.controller.ts](../../src/user/contribution.controller.ts) — `GET /api/contributions?assessmentId=` 의 필수 query 및 400 분기 계약(읽기만 — 수정 금지).
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) — `measureAndConfirmBaseline`, `MeasureBaselineOpts`, `RequestFn` 시그니처.
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) · [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) — `resolveBaselinePath` / `parseBaselineReport` / `ConfirmOrCompareResult`.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) — `createAuthenticatedE2EApp` · `buildAuthCookie` · `reseedAuthenticatedActors` (truncate 후 actor User 를 **원본 id 그대로** 재-seed 해야 FK 가 깨지지 않는다).
- [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `truncateAll`.
- [test/perf/README.md](../../test/perf/README.md) `1050 행` 부근 — slice 26 bullet 과 **잔여** 절(계수 정본). 본 task 가 갱신할 유일한 문서다.

## Acceptance Criteria

- [ ] `test/perf/contribution-measure-confirm-realdb.perf-spec.ts` 신규 생성 — mock(`useValue`) **0** · `overrideGuard` **0** 이고 실 `AppModule` 부트스트랩 + 실 JWT cookie 로 guard 를 통과한다 (`grep -c "useValue\|overrideGuard"` 결과 0).
- [ ] **happy path ①(established)** — baseline 부재 상태에서 `measureAndConfirmBaseline` 이 최초 확정 write 를 수행하고 그 baseline 파일이 실제로 생성됨을 `fs.existsSync` 로 단언하는 test 1+.
- [ ] **happy path ②(compared)** — 같은 label 로 재실행 시 로드 · 비교 국면(`ConfirmOrCompareResult` 의 compared 형태)에 도달함을 단언하는 test 1+. **`comparison.regressed` 값과 wall-clock 대소는 단언하지 않는다** (관찰 기록만 — flaky 차단, slice 3 · 23 · 24 · 25 · 26 선례).
- [ ] **분기 cover — 3-level FK chain 의 부모 id 선택** — 같은 `Person` 아래 **Assessment 2 건** 을 seed 하고 각 assessment 에 **서로 다른 개수** 의 `Contribution` 을 붙인 뒤, `?assessmentId=A` 와 `?assessmentId=B` **두 요청** 을 established · compared **양 국면 모두** 에서 태우는 test 를 각각 둔다 (본 slice 고유 축 — 부모 필터가 자식 집합을 실제로 가른다).
- [ ] **실 query 발화 입증** — 각 응답 배열 길이가 해당 assessment 의 seed row 수와 **정확히 일치** 하고 두 수가 **서로 다름** 을 단언한다 (mock 이면 성립할 수 없는 대조).
- [ ] **error path 2+** — (a) 공백-only `baseDir` 로 호출 시 `RangeError` 가 던져지고 **그 시점 파일 생성이 0** 임(순서 계약의 write 부작용 0)을 함께 단언, (b) 손상된 baseline JSON 을 심어 둔 뒤 `SyntaxError` 가 나는 것을 단언.
- [ ] **negative cases 5 종** — (a) `assessmentId` 누락(또는 빈 string) → **400**, (b) 존재하지 않는 `assessmentId` → **200 + `[]`**(404 아님), (c) cookie 미부착 → **401**, (d) 인위 non-2xx 와 200 혼합으로 `0 < errorRate < 1` (전부 non-2xx 는 `errorRate = 1`), (e) `truncateAll` 전/후 대조 쌍(N 건 → 0 건, 둘 다 200 — actor User 는 **원본 id 그대로** 재-seed).
- [ ] **임계 검증** — 기본 표본은 p95 **< 3000ms**(REQ-048) 로 pass 하고, 임계를 인위로 낮춰 주입한 표본은 fail 로 판정되는 test 1+.
- [ ] **저장소 오염 0** — baseline 은 `os.tmpdir()` 하위 test 별 임시 디렉토리에만 쓰고 `afterEach` 에서 재귀 삭제한다. spec 실행 후 `git status --porcelain` 에 신규 산출물이 없다.
- [ ] `test/perf/README.md` 갱신 — slice 27 bullet 신규 + **잔여** 절 계수 갱신: `*.perf-spec.ts` **60 → 61** · `*realdb*` **26 → 27** · `*read*` **51 불변**(여섯 번째 사례) · `*read*realdb*` **21 불변** · 도메인 **15** · 조회 route **31** · (A) **30** / (B) **0** / (C) **0** · mock 잔존 **30** · 규모 축 **3 route** 전부 불변, 재분류 0 이 **5 연속**. 계수는 실제 `ls test/perf/*.perf-spec.ts | wc -l` 등 glob 실측으로 검산한다.
- [ ] **완료 선언 0 유지** — README 의 "baseline 확정 축 미소진"(체크인 기준 baseline · CI job 편입 · 임계 fix 미착수) 서술과 4 잔여 축 존속 문구를 보존한다. `[x]` 전환 · REQ 상태 변경 금지.
- [ ] 명령 검증 — `pnpm lint && pnpm build` 통과, 신규 spec 이 `pnpm test:perf` 에서 통과, `pnpm test:cov` 가 line ≥ 80% / function ≥ 80% 를 유지 (production code 변경 0 이라 하락 없음).
- [ ] **cap 준수** — 변경 **2 파일**, 총 diff **≤ 300 LOC** (신규 spec 은 **≤ 255 LOC** 목표 — slice 25 · 26 이 `+300` · `+299` 로 경계에 붙었던 선례를 반복하지 않는다).

## Out of Scope

- production code · `src/user/contribution.controller.ts` · `prisma/schema.prisma` · 임계값(3000ms) 변경 — 본 task 는 **측정만** 한다.
- mock 짝(`contribution-measure-confirm.perf-spec.ts`) · slice 5(`contribution-read-realdb.perf-spec.ts`) 파일 수정 — 대체가 아니라 보완이며, (A) 부류 mock perf-spec 30 개의 retire 판단은 T-1536 유보 그대로.
- `GET /api/contributions/:id`(상세) · write route(POST · DELETE) perf 배선 — 다른 표면이다.
- 저장소 체크인 기준 baseline 파일 확정(`§ 5` #5) · CI job 편입(`§ 5` #4) · 임계 fix — baseline 확정 축의 후반부로 남긴다.
- `docs/PLAN.md` · `docs/ops/load-resilience-test-plan.md` · `docs/requirements.md` 갱신 — [CLAUDE.md](../../CLAUDE.md) `§3.1` rule 3(direct · pr mixed 금지) 에 따라 머지 후 **별도 direct doc-sync task** 로 이월한다.
- REQ-047 실 scale 부하 · 규모 민감도 · web 렌더 측정 — 다른 잔여 축.

## Suggested Sub-agents

`implementer → tester`

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
