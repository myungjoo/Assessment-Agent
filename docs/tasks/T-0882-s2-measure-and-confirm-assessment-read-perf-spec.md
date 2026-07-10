---
id: T-0882
title: S2 measure→confirm-or-compare 를 실 조회 endpoint(AssessmentController GET /api/assessments)에 배선하는 세 번째 통합 perf-spec 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-07-10
plannerNote: "P8 load-resilience §5 #2 — measureAndConfirmBaseline 을 평가 결과 조회 경로(assessments, period 분기 포함)에 세 번째 배선; cap-bend pre-justified R-112 backbone × 1.5, T-0880 패턴"
independentStream: s2-latency-harness
dependsOn: []
touchesFiles: [test/perf/assessment-measure-confirm.perf-spec.ts, test/perf/README.md]
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone perf-spec × 1.5 = ~300 LOC, T-0880(summary-measure-confirm +551, T-0877 +492 — 대부분이 R-112 test bulk·production 0 LOC·spec 전량이라 non-fixable Nit) 선례 정당화"
---

# T-0882 — S2 measure→confirm-or-compare 를 실 조회 endpoint(AssessmentController)에 배선하는 세 번째 통합 perf-spec 신설

## Why

[load-resilience-test-plan §5 follow-up #2](../ops/load-resilience-test-plan.md)(S2 조회 latency 경량 harness, REQ-048 "이미 저장된 평가 결과 조회·시각화 3초 이내")의 잔여 slice. T-0877 이 top-loop `measureAndConfirmBaseline` 을 floor-case `GET /api` health-read 에 처음 배선하고, T-0880 이 `SummaryController GET /api/summaries?personId` 로 두 번째 배선했다. 본 task 는 REQ-048 이 직접 겨냥하는 **"평가 결과 조회 경로"** 의 대표 endpoint 인 **`AssessmentController` `GET /api/assessments?personId=<id>&period=<day|week|month>`**(REQ-038 시계열 조회)를 `measureAndConfirmBaseline` loop 에 배선하는 세 번째 통합 perf-spec 을 신설한다. summary 대비 **`period` optional query 분기**를 추가로 태워, harness 가 단일-param 을 넘어 다중-query·400 강제 분기가 있는 실 조회 route 위에서도 established/compared round-trip 을 실증함을 보장한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2(조회 API 응답 지연)·§3(측정 지표·임계)·§5 #2 / #5.
- `test/perf/summary-measure-confirm.perf-spec.ts` — T-0880 이 신설한 measure→confirm-or-compare 두 번째 통합 perf-spec. 본 spec 의 직접 template(임시 baseDir fs 격리·established/compared 양분기·stepClock 결정론·guard override·injectStatus non-2xx 관용구를 그대로 차용).
- `test/perf/app-root-measure-confirm.perf-spec.ts` — T-0877 원본 template(floor-case 배선·established/compared 골격 참조).
- `test/perf/assessment-read.perf-spec.ts` — AssessmentController + guard override(`overrideGuard(...).useValue({ canActivate: () => true })`) + mock `AssessmentService` 배선·`GET /api/assessments?personId=&period=` 요청·400 분류 관용구. 본 spec 의 endpoint 배선 부분 참조.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline` / `measureBaselineCandidate` / `RequestFn` export 서명(호출·import 만, 수정 금지).
- `test/perf/latency-baseline.ts` — `BaselineEnvMeta` / `resolveBaselinePath` / `parseBaselineReport` export(호출·import 만, 수정 금지).
- `src/user/assessment.controller.ts` — `GET /api/assessments`(findByPerson, `@Query("personId")` 필수·부재 시 `BadRequestException`→400, `@Query("period")` optional 분기) 라우트 shape·guard·RBAC(`@Roles("User")`).
- `test/perf/README.md` — perf-spec 목록·cross-ref(신규 spec 1줄 추가 대상).
- `test/perf/jest-perf.json` — `testRegex: test/perf/.*\.perf-spec\.ts$`(신규 파일이 `test:perf` 로만 매칭됨을 확인).

신규 spec 은 **colocated** 위치 `test/perf/assessment-measure-confirm.perf-spec.ts` 에 둔다(기존 perf-spec 이 전부 `test/perf/` 평면 배치이므로 그 convention 준수).

## Acceptance Criteria

- [ ] `test/perf/assessment-measure-confirm.perf-spec.ts` 신설 — `measureAndConfirmBaseline` 을 `() => request(app.getHttpServer()).get("/api/assessments?personId=<fixed>")` 실 supertest 요청 + 임시 baseDir fs baseline round-trip 에 배선. `AssessmentController` + `AssessmentService`(mock `useValue`) + `JwtAuthGuard`/`RolesGuard` override(`{ canActivate: () => true }`) 로 부트스트랩. collector/io/baseline `.ts` 모듈은 import·호출만(재구현 0).
- [ ] **Happy-path**: established(빈 baseDir 첫 호출 → `outcome=established` + baseline JSON 실 write·round-trip 동치·실 200 반영 errorRate 0/count>0/pass=true) 와 compared(재호출 → `outcome=compared` + `comparison.regressed=false`·report 문자열) **두 국면 양쪽**을 실 HTTP·실 fs 위에서 각 1+ test. compared happy-path 는 1차·2차 measure 에 **stepClock 주입**으로 regressed 비결정성을 제거(T-0881 결정론화 관용구 준수).
- [ ] **Error path**: 하위 예외가 부작용 없이 전파되는 경로 각 1+ — request 함수 null(TypeError·파일 미생성) · `measure.iterations` 음수/NaN(RangeError) · env.label 빈 문자열(RangeError·파일 미생성) · baseDir non-string(TypeError)/공백-only(RangeError) · compared 분기 저장 파일 손상(SyntaxError).
- [ ] **Flow / branch coverage**: 부재→established(write 발생) vs 존재→compared(read-only·mtime 불변) 분기 · `opts.measure.iterations` 위임(요청 횟수 일치) · `opts.compare.latencyTolerance` 좁힘→`regressed=true`(회귀 검출) vs 기본 tolerance→`regressed=false`(무회귀) 각 1+ test. stepClock 주입으로 회귀 판정 결정론화.
- [ ] **Negative cases 충분 cover**: opts 미지정→기본 iterations 30 established 도달 · 요청 wrapper 인위 503 반환→errorRate 위반(pass=false) candidate 가 throw 없이 established write(관찰 전용) · **personId 부재 요청(400)→errorRate 위반 candidate established write**(AssessmentController query-param 필수 분기) · **period 부재 vs period 지정(`?personId=&period=week`) 두 요청 형태 모두 established/compared 도달**(summary 에 없던 assessments 고유 optional query 분기) · compared 회귀는 `regressed=true` 로만 노출·함수 resolve(throw 안 함) · measure reject(env 형태 불량)→confirm 미도달·파일 미생성 · 수동 조립(`measureBaselineCandidate`)과 established candidate round-trip 동치 각 1+ test.
- [ ] `pnpm test:perf` 통과(신규 spec 포함 전체 perf 스위트 green). production `src/` 변경 0 이므로 신규 spec 은 `test:perf` 로만 매칭·실행됨을 확인(`pnpm test` 기본 매칭 0).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 신규 파일은 perf-spec(테스트 자산)이라 `collectCoverageFrom=src/**` 계측 대상 아님 — 기존 src 커버리지 무영향만 확인.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `test/perf/README.md` 에 신규 spec 1줄 cross-ref 추가(summary-measure-confirm·app-root-measure-confirm 인접).

## Out of Scope

- collector / io / baseline `.ts` 모듈 함수 수정 또는 신규 primitive 추가(본 task 는 **배선·호출만**).
- 또 다른 endpoint(person/group/contribution/export 등) 동시 배선 — 본 task 는 AssessmentController findByPerson 1개만.
- `@Get(":id")` findOne(assessment-detail) 배선 — 후속 slice.
- write route perf(POST/PATCH/DELETE) latency 측정.
- 실 PostgreSQL·실 Prisma·실 LLM round-trip(AssessmentService 는 mock 유지). baseline 실측(§5 #5 실 DB round-trip)은 별도 slice.
- 병렬·동시성 request(S3 시나리오) — 본 task 는 S2 단일-클라이언트 순차 measure 만.
- 실 baseline JSON 을 repo 에 체크인(§5 #5).
- CI perf job 재구성(§5 #4 — 이미 T-0878/T-0879 로 test:perf step·empty-guard 완료).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
