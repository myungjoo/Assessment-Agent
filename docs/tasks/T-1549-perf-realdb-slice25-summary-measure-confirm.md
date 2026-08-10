---
id: T-1549
title: 실 DB perf slice 25 — measure→confirm-or-compare baseline loop 를 실 DB round-trip 에 첫 배선 (GET /api/summaries)
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 290
estimatedFiles: 3
created: 2026-08-10
createdAt: 2026-08-10T01:05:00Z
independentStream: perf-realdb-slices
dependsOn: [T-1548]
touchesFiles:
  - test/perf/summary-measure-confirm-realdb.perf-spec.ts
  - test/perf/README.md
  - docs/tasks/T-1549-perf-realdb-slice25-summary-measure-confirm.md
plannerNote: "PLAN 140~142 행 잔여 축 (c) baseline 확정 첫 진입 — measure→confirm loop 의 첫 실 DB 배선 (규모 축 아님, 계수 58 → 59 / realdb 24 → 25)"
---

# T-1549 — 실 DB perf slice 25: `GET /api/summaries` measure→confirm-or-compare baseline loop

## Why

[T-1548](T-1548-perf-realdb-slice24-doc-sync.md) 이 slice 24 doc-sync 를 마친 뒤에도
[PLAN.md](../PLAN.md) `140 행` 성능 검증 bullet 은 `[ ]`, [requirements.md](../requirements.md)
REQ-048 은 `IN_PROGRESS`, [부하계획](../ops/load-resilience-test-plan.md) `§ 5` item 5 는
**미완** 이다. 잔여 축은 넷 — (a) (A) 부류 mock spec 30 개 retire 판단, (b) 규모 민감도,
(c) **baseline 확정 · 임계 fix**, (d) web 렌더 측정 + REQ-047 실 scale 부하. slice 23 · 24 가
연속으로 (b) 를 골랐으므로 본 slice 는 **(c) 의 첫 절반** — baseline **확정 국면** — 을 택한다.
임계 fix 는 여전히 범위 밖이다 (아래 Out of Scope).

**본 slice 고유 축 ① — measure→confirm loop 의 첫 실 DB 배선.**
[`measureAndConfirmBaseline`](../../test/perf/latency-collector.ts) 은 candidate 측정 →
`confirmOrCompareBaseline`(기준 부재면 최초 확정 write / 존재면 로드·비교)을 이어붙인
top-of-pyramid 진입점이고, 이 loop 를 실 supertest + 실 fs 에 태운 perf-spec 은 이미 넷
있다 (`app-root-measure-confirm` T-0877 · `summary-measure-confirm` T-0880 ·
`assessment-measure-confirm` · `contribution-measure-confirm`). 그러나 **네 개 전부 service 를
`useValue` mock 으로 갈아끼우고 guard 를 `overrideGuard` 로 벗긴 배선** 이라 (파일명에 `realdb`
가 하나도 없다), "측정치가 실 Postgres round-trip 지연을 포함할 때도 established → compared
두 국면이 성립하는가" 는 **한 번도 관측된 적이 없다**. 본 slice 가 그 첫 표본이다.

**본 slice 고유 축 ② — slice 6 과 같은 route 를 다른 harness 로 잰다.**
`summary-read-realdb.perf-spec.ts`(slice 6, T-1510) 는 같은 route 를 실 DB 로 이미 쟀지만
`collectLatencySamples` + `assertS2Threshold` 의 **관찰 전용** 이고 baseline 은 디스크에
쓰지 않았다 (README `1032 행` 부근 — "`writeBaselineFile`/`confirmOrCompareBaseline` 로
baseline 을 확정하지도 않는다"). 본 slice 는 그 서술을 **route 하나에 한해** 처음으로 넘어서서
임시 디렉토리 baseline JSON 을 확정하고 재실행 비교까지 잇는다. 대상 route 선택 근거는
T-0880 과 **같은 route** 라 mock ↔ 실 DB 대조가 1:1 로 성립하기 때문이다.

**측정만 한다** — `SummaryService` 쿼리 최적화 · index 추가 · 임계값 변경 · production code
변경은 관측 결과와 무관하게 전부 범위 밖이다 (schema 변경은 [CLAUDE.md](../../CLAUDE.md) `§5`
BLOCKED 게이트 대상이기도 하다).

**계수 함정 ① — `read` glob 두 개 다 불변 (네 번째 사례).** 새 파일명
`summary-measure-confirm-realdb.perf-spec.ts` 에는 **`read` 가 없다** (slice 3 · 23 · 24 에 이은
**네 번째**). 따라서 `*read*` 는 **51 불변** · `*read*realdb*` 는 **21 불변** 이고 계산식
`read 51 개 − 실 DB read 21 개 = 30` 이 **식도 결과도 그대로** 다. 늘어나는 것은 perf-spec 총계
**58 → 59** 와 `*realdb*` **24 → 25** 뿐이다.

**계수 함정 ② — 재분류 0 이 3 연속.** 대상 `GET /api/summaries` 는 **slice 6 이 이미 실측한
route** 라 실측 도메인 **15 불변** · 조회 route **31 불변** · 인벤토리 (A) **30** / (B) **0** /
(C) **0** 이 전부 불변이다. T-1546 의 "재분류 0 인 **첫** slice" · T-1548 의 "**2 연속**" 문형을
**복사하지 않는다** (본 slice 는 3 연속이다).

**계수 함정 ③ — 규모 축은 늘지 않는다.** slice 23 · 24 와 달리 본 slice 는 **규모 축 slice 가
아니다**. 규모 축 route 는 **3 route 그대로** 이며 (`:id/persons` · `/api/persons` ·
`/api/assessments`) 본 slice 를 4 번째 규모 축으로 세지 않는다.

**계수 함정 ④ — 잔여 축 (c) 는 소진되지 않는다.** 본 slice 가 확정하는 baseline 은 **매 test
마다 만들었다 지우는 임시 디렉토리** 안에 있다. repo 체크인된 기준 baseline(§5 #5) · CI job
편입(§5 #4) · 임계 fix 는 **전부 미착수 그대로** 다. "baseline 확정 완료" 로 읽히는 표현을
쓰지 않는다.

## Required Reading

- [test/perf/summary-measure-confirm.perf-spec.ts](../../test/perf/summary-measure-confirm.perf-spec.ts)
  (T-0880) — **harness 구조 정본**. `measureAndConfirmBaseline` 호출 형태 · 임시 baseDir
  생성·삭제 규약 · env-meta fixture · established/compared 양분기 도달 방식을 승계한다.
  **수정 금지** (본 slice 는 별도 파일이고 mock 짝을 대체하지 않는다).
- [test/perf/summary-read-realdb.perf-spec.ts](../../test/perf/summary-read-realdb.perf-spec.ts)
  (slice 6, T-1510) — **실 DB 부트스트랩 정본**. `createAuthenticatedE2EApp` ·
  `buildAuthCookie` · `afterEach(truncateAll)` 직후 `reseedAuthenticatedActors` ·
  `@@unique([personId, period, periodStart])` 충돌 회피용 `periodStart` 분산 seed 방식.
  **수정 금지**.
- [test/perf/latency-collector.ts](../../test/perf/latency-collector.ts) `330~395 행` —
  `measureAndConfirmBaseline(request, env, baseDir, opts)` 시그니처와 순서 계약 (measure 가
  throw 하면 write·compare 부작용 0), `MeasureAndConfirmOpts.measure.now` 주입 clock.
  **primitive 수정 금지**.
- [test/perf/latency-baseline-io.ts](../../test/perf/latency-baseline-io.ts) 의
  `confirmOrCompareBaseline` · `baselineFileExists` docstring — `ConfirmOrCompareResult` 판별
  union (`"established"` + `path` / `"compared"` + `comparison` + `report`) 과 예외 전파 계약
  (`TypeError` / `RangeError` / `ENOENT` / `SyntaxError`). **수정 금지**.
- [test/perf/latency-baseline.ts](../../test/perf/latency-baseline.ts) 의 `BaselineEnvMeta` ·
  `resolveBaselinePath` — 파일명 slug 결정 규약 (env.label 정규화). **수정 금지**.
- [src/user/summary.controller.ts](../../src/user/summary.controller.ts) `99~113 행` —
  `findByPerson` 의 필수 `personId` 400 분기 · `period` 유무 분기 · guard stack
  (`JwtAuthGuard` + `RolesGuard` + `@Roles("User")`). **수정 금지**.
- [test/helpers/auth-e2e-helper.ts](../../test/helpers/auth-e2e-helper.ts) ·
  [test/helpers/db-truncate.ts](../../test/helpers/db-truncate.ts) — `createAuthenticatedE2EApp`
  반환 형태 · `reseedAuthenticatedActors` 의 **원본 id 그대로 재삽입** 계약 · `truncateAll`
  정리 범위. **둘 다 수정 금지**.
- [test/perf/README.md](../../test/perf/README.md) `## 실 DB round-trip baseline (slice 목록)` 의
  **slice 24 bullet** 과 말미 **잔여** bullet — 본 task 가 갱신할 유일한 문서 (정본).
- [docs/tasks/T-1547-perf-realdb-slice24-assessment-list-scale.md](T-1547-perf-realdb-slice24-assessment-list-scale.md)
  `## Acceptance Criteria` — 실 DB slice 의 AC 문형 · flaky 차단 규약 · 완료 선언 0 원칙의
  승계 출처.

## Acceptance Criteria

- [ ] **AC 1 — 신규 spec 1 개.** `test/perf/summary-measure-confirm-realdb.perf-spec.ts` 를 새로
  만든다. `createAuthenticatedE2EApp([{ role: "User" }])` 로 **mock override 0 · guard override
  0** 인 실 `AppModule` 을 부트스트랩하고 `ctx.prisma` 실 client 로 seed 한다. 기존 perf-spec ·
  helper · primitive · production code · schema 는 **한 파일도 수정하지 않는다**. 헤더 주석은
  slice 6 · T-0880 을 **cross-ref** 로 승계하되 산문 복제 없이 **≤ 25 줄**.
- [ ] **AC 2 — happy-path ① established 분기 (최초 확정 write).** 기준 baseline 이 **부재한**
  임시 baseDir 에서 `measureAndConfirmBaseline` 을 실 JWT cookie 의
  `GET /api/summaries?personId=<id>` 요청으로 호출해 `outcome === "established"` 와 반환
  `path` 의 **파일 실제 존재**(`fs.existsSync`) 를 확인하고, 그 파일을 `parseBaselineReport` 로
  되읽어 `count` 가 반복 횟수와 일치 · `errorRate === 0` · seed row 수와 일치하는 응답을
  받았음을 확인한다 (실 query 발화 입증).
- [ ] **AC 3 — happy-path ② compared 분기 (재실행 로드·비교).** 같은 baseDir 로 **두 번째**
  `measureAndConfirmBaseline` 을 호출해 `outcome === "compared"` 이고 `comparison` 의 지표 키
  (p50 · p95 · p99 · errorRate · throughput) 와 `report` 문자열이 모두 산출됨을 확인한다.
  **`comparison.regressed` 의 true/false 자체는 단언하지 않는다** (AC 6).
- [ ] **AC 4 — error path (하위 primitive 예외 전파 + 부작용 0).** 최소 2 종 —
  (a) `baseDir` 을 **빈/공백-only** 로 준 호출이 `RangeError` 로 reject 되고,
  (b) 기준 baseline 파일 내용을 **손상 JSON** 으로 덮어쓴 뒤의 호출이 `SyntaxError` 로 reject
  된다. (a) 에서는 **어떤 파일도 생성되지 않았음** 을 확인해 "measure→confirm 순서 계약상
  write 부작용 0" 을 실증한다.
- [ ] **AC 5 — 분기 cover.** 다음 분기를 각각 1+ test 로 도달시킨다 —
  ⓐ `confirmOrCompareBaseline` 의 **부재(established) / 존재(compared)** 양분기 (AC 2 · 3),
  ⓑ controller 의 **`period` 지정 / 미지정** 양분기 (지정 시 응답 길이가 해당 period seed 수와,
  미지정 시 전체 seed 수와 **정확히 일치**),
  ⓒ `assertS2Threshold` 계열 **pass 분기** 와 `measure.thresholds` 에 `p95MaxMs: 0` 을 주입한
  **fail 분기** (실 측정 시간에 무의존한 결정론적 도달).
- [ ] **AC 6 — 대소 관계 · 회귀 판정 assert 금지 (flaky 차단).** 실 DB wall-clock 은
  비결정적이므로 두 run 의 latency 대소나 `comparison.regressed` 값을 **단언하지 않고**
  `observations` 배열에 관측 기록으로만 남긴다 (slice 3 · 23 · 24 선례). 단언하는 것은
  **분기 도달 · 응답 길이 일치 · 각 run 이 임계 아래** 라는 것뿐이다. 결정론적 비교가 필요한
  케이스는 `opts.measure.now` 에 monotonic clock 을 주입해 만든다.
- [ ] **AC 7 — negative cases 충분 cover (각 1+ test).** 최소 다음 5 종 —
  (a) **`personId` 누락** 요청이 **400** 이고, 그 표본의 `errorRate` 위반 candidate 도
  established write 는 **수행됨** (관찰 전용 — throw 하지 않음),
  (b) **매칭 0 건**(존재하지 않는 `personId`) 요청이 404 가 아니라 **200 + `[]`** (경계값),
  (c) **cookie 미부착** 요청이 **401** (`JwtAuthGuard` 생존),
  (d) 인위 **non-2xx 주입** 표본의 `errorRate === 1` 과, 2xx 혼합 표본의 **`0 < errorRate < 1`**,
  (e) seed 를 `truncateAll` 로 비운 **전/후 대조 쌍** 에서 응답 길이가 N → 0 으로 바뀌고 두
  요청 모두 **200** 임. truncate 가 actor `User` row 도 지우므로 **`reseedAuthenticatedActors`
  로 원본 id 그대로 재삽입** 한다 (새 id · token 재발급 금지, `db-truncate.ts` 수정 0).
- [ ] **AC 8 — 임시 baseDir 격리 (repo 오염 0).** baseline 디렉토리는 매 test 마다
  `fs.mkdtempSync(path.join(os.tmpdir(), ...))` 로 만들고 `afterEach` 에서 **재귀 삭제** 한다.
  저장소 안에는 baseline JSON 이 **한 개도 생성되지 않아야** 하며, 편집 후
  `git status --porcelain` 에 baseline 산출물이 나타나지 않음을 확인한다.
- [ ] **AC 9 — 실행 · 통과 확인.** `pnpm test:perf` 로 신규 spec 이 실행돼 **전부 pass** 하고,
  `pnpm lint && pnpm build && pnpm test` 도 통과한다 (기본 `pnpm test` 는 `.perf-spec.ts` 를
  picking 하지 않으므로 계수 변화 0). CI 의 `perf test` step 도 green 이어야 한다.
- [ ] **AC 10 — coverage.** `pnpm test:cov` 가 **line ≥ 80% / function ≥ 80%** 로 통과한다
  (본 task 는 production code 변경 0 이라 coverage 수치 변동이 없어야 한다 — 회귀 0 확인 목적).
- [ ] **AC 11 — 정본 문서 갱신 (`test/perf/README.md` 1 파일만).**
  `## 실 DB round-trip baseline (slice 목록)` 에 **slice 25 bullet** 을 추가하고 말미 **잔여**
  bullet 의 계수를 갱신한다 — perf-spec **58 → 59** · `*realdb*` **24 → 25**, `*read*`
  **51 불변** · `*read*realdb*` **21 불변** · mock 잔존 **30 불변** · 도메인 **15 불변** · 조회
  route **31 불변** · 인벤토리 (A) 30 / (B) 0 / (C) 0 **불변** · **규모 축 route 3 불변**
  (본 slice 는 규모 축이 아니다 — 계수 함정 ③). 개수는 **편집 전 실측값**
  (`ls test/perf/*.perf-spec.ts | wc -l` 계열 glob 4 종) 으로 확인해 적는다. slice 25 bullet 은
  **≤ 30 줄** 이고 slice 6 · T-0880 의 산문을 복제하지 않는다 (cross-ref).
- [ ] **AC 12 — 완료 선언 0 (계수 함정 ④).** [PLAN.md](../PLAN.md) ·
  [requirements.md](../requirements.md) · [부하계획](../ops/load-resilience-test-plan.md) 은
  **본 task 에서 수정하지 않는다** (doc-sync 는 후속 `direct` task 몫 — [CLAUDE.md](../../CLAUDE.md)
  `§3.1` rule 3 mixed 금지). README 안에서도 **"baseline 확정 완료" · "잔여 축 (c) 해소" ·
  "REQ-048 검증 완료"** 로 읽히는 문장을 쓰지 않는다 — 본 slice 의 baseline 은 **임시 디렉토리
  1 회성** 이고 repo 체크인 기준 baseline · CI job 편입 · 임계 fix 는 **전부 미착수** 임을
  1 구절로 명시한다. 본 표본이 **REQ-047 실 scale 부하가 아님** 도 함께 명시한다.
- [ ] **AC 13 — 크기 · 표기 검산.** `git diff --stat` 이 **3 파일 / ≤ 300 LOC** 임을 확인한다.
  새로 추가하는 행 좌표 표기는 [CLAUDE.md](../../CLAUDE.md) §12 "범위 좌표 표기"
  (`§ 12.76` `R1` · `R4` · `R5 (§ 12.91 개정)`) 를 따른다 — 구분자 `~`, 단일 행은 `99 행`,
  `L` prefix 금지, 기존 행 소급 치환 금지.

## Out of Scope

- **production code · schema 변경 일체** (`src/` · `prisma/`) — `SummaryService` 쿼리 최적화 ·
  index 추가 · 페이지네이션은 관측 결과와 무관하게 범위 밖이다 (schema 는 §5 BLOCKED 게이트
  대상).
- **repo 체크인 baseline JSON 확정** (부하계획 `§ 5` #5 잔여) — 본 slice 의 baseline 은 **임시
  디렉토리 1 회성** 이다. 기준 baseline 을 저장소에 커밋하거나 `.gitignore` 를 손대지 않는다.
- **CI job 편입** (`§ 5` #4) · **임계값 변경** — `DEFAULT_P95_MAX_MS = 3000` 불변,
  `.github/workflows/ci.yml` 미편집 (기존 `testRegex` 가 새 spec 을 자동 picking 한다).
- **기존 perf-spec · helper · primitive 수정** — 특히
  [`summary-measure-confirm.perf-spec.ts`](../../test/perf/summary-measure-confirm.perf-spec.ts)
  (T-0880) · [`summary-read-realdb.perf-spec.ts`](../../test/perf/summary-read-realdb.perf-spec.ts)
  (slice 6) · `auth-e2e-helper.ts` · `db-truncate.ts` · `latency-*.ts` 는 **읽기 전용** 이다.
- **mock 짝 retire · 삭제 · 통합** — (A) 부류 30 개의 retire 판단은 T-1536 이 유보한 별도
  축이다 (본 slice 는 대체가 아니라 보완 — mock 잔존 계수 불변).
- **PLAN · requirements · 부하계획 문서 갱신** (AC 12) — 후속 doc-sync `direct` task 몫.
- **다른 endpoint 의 measure→confirm 실 DB 배선 · 규모 축 확장 · write / trigger route 측정 ·
  동시성(S3) · REQ-047 실 scale 부하 · web 렌더 측정** — 각각 별도 축.
- **단건 상세 route(`GET /api/summaries/:id`) 배선** — 본 slice 는 목록 route 하나만 다룬다.
- **403 tier 분기 측정** — `@Roles("User")` 라 인증된 모든 role 이 통과한다. 401 만 negative 로
  덮고 403 은 만들지 않는다 (이미 덮인 축이라 새 축도 아니다).
- **ADR 신설 · 새 dependency 도입** — 본 slice 는 기존 primitive 조립만 한다 (신규 결정 0).

## Suggested Sub-agents

`implementer → tester` (architect 불요 — 새 결정 0, 기존 harness · slice 구조 승계).

## Follow-ups

(생성 시점 비어 있음 — sub-agent 가 관련 작업을 발견하면 여기에 append)
