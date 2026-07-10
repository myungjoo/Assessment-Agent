---
id: T-0880
title: S2 measure→confirm-or-compare 를 실 조회 endpoint(SummaryController GET /api/summaries)에 배선하는 두 번째 통합 perf-spec 신설
phase: P5
status: DONE
commitMode: pr
prNumber: 774
mergedAs: effb2b6c41bbb9707764b631194886196b2d5ca3
reviewRounds: 1
completedAt: 2026-07-10T11:14:06Z
resolvedNote: "ci-repeat-fail unblock 완결 — T-0881(app-root compared 결정론화) merge 후 본 fire(cron@aa-local-3e572e17)가 nextTask=T-0880 을 LOOP [2] frontmatter-prNumber(774) resume: integrator 가 gh pr update-branch 774 로 T-0881 fix 포함 main 병합(no force-push) → 새 head CI green(test:perf 포함) → 4-게이트 PASS → PR #774 squash effb2b6c + branch delete. 중복 PR 0(prNumber:774 resume)."
coversReq: [REQ-048]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-07-10
plannerNote: "P8 load-resilience §5 #2 — measureAndConfirmBaseline 을 floor-case GET /api 넘어 실 S2 조회 endpoint(summaries)에 첫 배선; cap-bend pre-justified R-112 backbone × 1.5, T-0877 패턴"
independentStream: s2-latency-harness
dependsOn: []
touchesFiles: [test/perf/summary-measure-confirm.perf-spec.ts, test/perf/README.md]
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone perf-spec × 1.5 = ~300 LOC, T-0877(app-root-measure-confirm +492/-5, 280+ LOC 가 R-112 test bulk) 선례 정당화 — production 0 LOC·spec 전량이라 non-fixable Nit"
---

# T-0880 — S2 measure→confirm-or-compare 를 실 조회 endpoint(SummaryController)에 배선하는 두 번째 통합 perf-spec 신설

## Why

[load-resilience-test-plan §5 follow-up #2](../ops/load-resilience-test-plan.md)(S2 조회 latency 경량 harness, REQ-048 "조회·시각화 3초 이내")의 잔여 slice. 직전 T-0877 이 top-loop `measureAndConfirmBaseline` 을 **실 NestJS supertest + 실 fs baseline round-trip** 에 처음 배선했지만, 대상은 guard·param·예외경로가 전무한 **floor-case `GET /api` health-read** 하나뿐이었고, T-0877 §Out of Scope 가 "다른 endpoint(person/group/assessment 등) 배선" 을 명시적으로 이월했다. 본 task 는 그 이월분을 이어받아, S2 시나리오가 실제로 겨냥하는 **"평가 결과 조회 경로"**([load-resilience-test-plan §2 S2](../ops/load-resilience-test-plan.md) "요약·평가 결과 조회 read API")의 대표 endpoint 인 **`SummaryController` `GET /api/summaries?personId=<id>`** 를 `measureAndConfirmBaseline` loop 에 배선하는 두 번째 통합 perf-spec 을 신설한다 — guard stack(JwtAuthGuard/RolesGuard) override + query-param 분기(personId 부재→400)를 태워 floor-case 보다 실전에 가까운 established/compared round-trip 을 실증한다.

## Required Reading

- [docs/ops/load-resilience-test-plan.md](../ops/load-resilience-test-plan.md) — §2 S2(조회 API 응답 지연)·§3(측정 지표·임계)·§5 #2 / #5.
- `test/perf/app-root-measure-confirm.perf-spec.ts` — T-0877 가 신설한 measure→confirm-or-compare 첫 통합 perf-spec. 본 spec 의 직접 template(임시 baseDir fs 격리·established/compared 양분기·stepClock 결정론·injectStatus non-2xx 관용구를 그대로 차용).
- `test/perf/summary-read.perf-spec.ts` — SummaryController + guard override + mock service 배선 관용구(passGuard·overrideGuard 패턴). 본 spec 의 endpoint 배선 부분 참조.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline` / `measureBaselineCandidate` / `RequestFn` export 서명(호출·import 만, 수정 금지).
- `test/perf/latency-baseline.ts` — `BaselineEnvMeta` / `resolveBaselinePath` / `parseBaselineReport` export(호출·import 만, 수정 금지).
- `src/user/summary.controller.ts` — `GET /api/summaries`(findByPerson, `@Query("personId")` 필수·부재 시 `BadRequestException`→400) 라우트 shape·guard·RBAC.
- `test/perf/README.md` — perf-spec 목록·cross-ref(신규 spec 1줄 추가 대상).
- `test/perf/jest-perf.json` — `testRegex: test/perf/.*\.perf-spec\.ts$`(신규 파일이 `test:perf` 로만 매칭됨을 확인).

신규 spec 은 **colocated** 위치 `test/perf/summary-measure-confirm.perf-spec.ts` 에 둔다(기존 perf-spec 이 전부 `test/perf/` 평면 배치이므로 그 convention 준수).

## Acceptance Criteria

- [ ] `test/perf/summary-measure-confirm.perf-spec.ts` 신설 — `measureAndConfirmBaseline` 을 `() => request(app.getHttpServer()).get("/api/summaries?personId=<fixed>")` 실 supertest 요청 + 임시 baseDir fs baseline round-trip 에 배선. `SummaryController` + `SummaryService`(mock `useValue`) + `JwtAuthGuard`/`RolesGuard` override(`{ canActivate: () => true }`) 로 부트스트랩. collector/io/baseline `.ts` 모듈은 import·호출만(재구현 0).
- [ ] **Happy-path**: established(빈 baseDir 첫 호출 → `outcome=established` + baseline JSON 실 write·round-trip 동치·실 200 반영 errorRate 0/count>0/pass=true) 와 compared(재호출 → `outcome=compared` + `comparison.regressed=false`·report 문자열) **두 국면 양쪽**을 실 HTTP·실 fs 위에서 각 1+ test.
- [ ] **Error path**: 하위 예외가 부작용 없이 전파되는 경로 각 1+ — request 함수 null(TypeError·파일 미생성) · `measure.iterations` 음수/NaN(RangeError) · env.label 빈 문자열(RangeError·파일 미생성) · baseDir non-string(TypeError)/공백-only(RangeError) · compared 분기 저장 파일 손상(SyntaxError).
- [ ] **Flow / branch coverage**: 부재→established(write 발생) vs 존재→compared(read-only·mtime 불변) 분기 · `opts.measure.iterations` 위임(요청 횟수 일치) · `opts.compare.latencyTolerance` 좁힘→`regressed=true`(회귀 검출) vs 기본 tolerance→`regressed=false`(무회귀) 각 1+ test. stepClock 주입으로 회귀 판정 결정론화.
- [ ] **Negative cases 충분 cover**: opts 미지정→기본 iterations 30 established 도달 · 요청 wrapper 인위 503 반환→errorRate 위반(pass=false) candidate 가 throw 없이 established write(관찰 전용) · **personId 부재 요청(400)→errorRate 위반 candidate established write**(SummaryController 고유 query-param 분기 — floor-case 에 없던 실 예외경로) · compared 회귀는 `regressed=true` 로만 노출·함수 resolve(throw 안 함) · measure reject(env 형태 불량)→confirm 미도달·파일 미생성 · 수동 조립(`measureBaselineCandidate`)과 established candidate round-trip 동치 각 1+ test.
- [ ] `pnpm test:perf` 통과(신규 spec 포함 전체 perf 스위트 green). production `src/` 변경 0 이므로 신규 spec 은 `test:perf` 로만 매칭·실행됨을 확인(`pnpm test` 기본 매칭 0).
- [ ] `pnpm test:cov` 통과(line ≥ 80% / function ≥ 80% 무회귀). 신규 파일은 perf-spec(테스트 자산)이라 `collectCoverageFrom=src/**` 계측 대상 아님 — 기존 src 커버리지 무영향만 확인.
- [ ] `pnpm lint && pnpm build` green.
- [ ] `test/perf/README.md` 에 신규 spec 1줄 cross-ref 추가(app-root-measure-confirm 인접).

## Out of Scope

- collector / io / baseline `.ts` 모듈 함수 수정 또는 신규 primitive 추가(본 task 는 **배선·호출만**).
- 또 다른 endpoint(person/group/assessment/contribution 등) 동시 배선 — 본 task 는 SummaryController 1개만.
- write route perf(POST/PATCH/DELETE) latency 측정.
- 실 PostgreSQL·실 Prisma·실 LLM round-trip(SummaryService 는 mock 유지). baseline 실측(§5 #5 실 DB round-trip)은 별도 slice.
- 병렬·동시성 request(S3 시나리오) — 본 task 는 S2 단일-클라이언트 순차 measure 만.
- 실 baseline JSON 을 repo 에 체크인(§5 #5).
- CI perf job 재구성(§5 #4 — 이미 T-0878/T-0879 로 test:perf step·empty-guard 완료).

## Suggested Sub-agents

implementer → tester

## Follow-ups

(비어 있음 — sub-agent 가 관련 작업 발견 시 추가)
