---
id: T-0883
title: S2 measure→confirm-or-compare 를 실 조회 endpoint(ContributionController GET /api/contributions?assessmentId)에 배선하는 네 번째 통합 perf-spec 신설
phase: P5
status: PENDING
commitMode: pr
coversReq: [REQ-048]
estimatedDiff: 300
estimatedFiles: 2
created: 2026-07-10
plannerNote: "P8 load-resilience §5 #2 — measureAndConfirmBaseline 을 평가 결과 조회 경로(contributions, assessmentId 필수·400 분기)에 네 번째 배선; 평가-결과 read 표면의 마지막 distinct slice, cap-bend pre-justified R-112 backbone × 1.5, T-0882 패턴"
independentStream: s2-latency-harness
dependsOn: []
touchesFiles: [test/perf/contribution-measure-confirm.perf-spec.ts, test/perf/README.md]
sizeExempt: true
exemptReason: "cap-bend pre-justified: R-112 backbone perf-spec × 1.5 = ~300 LOC, T-0882(assessment-measure-confirm ~612)·T-0880(summary +551)·T-0877(app-root +492) 선례 — 대부분이 R-112 test bulk·production 0 LOC·spec 전량이라 non-fixable Nit"
---

# T-0883 — S2 measure→confirm-or-compare 를 실 조회 endpoint(ContributionController)에 배선하는 네 번째 통합 perf-spec 신설

## Why

P8 `[ ] 부하·내성 테스트` bullet 의 load-resilience 계획 §5 follow-up #2(S2 조회 latency 경량 harness / REQ-048 조회 p95 < 3s)를 잇는다. T-0877(app-root health floor-case)·T-0880(SummaryController)·T-0882(AssessmentController, period 분기 포함)가 top loop `measureAndConfirmBaseline` 을 실 NestJS supertest + 실 fs baseline round-trip 에 배선했다. 본 task 는 REQ-048 이 겨냥하는 **평가 결과 조회·시각화 경로**의 마지막 distinct read 표면인 **`ContributionController` `GET /api/contributions?assessmentId=<id>`**(REQ-033 aggregate-level 기여 조회 = 시각화의 기여 내역)를 같은 loop 에 배선해, harness 가 요약·평가·기여 3 read 경로 전반에서 established/compared round-trip 을 실증하도록 한다.

> 정직성 note (make-work 경계): 본 slice 는 평가-결과 read 표면의 **네 번째이자 마지막 genuinely-distinct 경로**다. contribution(기여 내역)은 summary/assessment 와 다른 실 조회 route(다른 controller·다른 필수 query `assessmentId`·다른 400 분기)라 genuine 이다. 그러나 이후 person/group/part 등 **조직 구조 read**를 loop 에 배선하는 것은 REQ-048 의 "평가 결과 조회"가 아니므로 make-work 다. Follow-ups 에 다음 planner 를 위한 escalation 지침을 박제한다.

## Required Reading

- `docs/ops/load-resilience-test-plan.md` — §2 S2(조회 API 응답 지연)·§3 임계 표·§5 follow-up #2. 본 spec 이 어느 follow-up 을 잇는지.
- `test/perf/assessment-measure-confirm.perf-spec.ts` — **직전(T-0882) 세 번째 배선 패턴**. 본 spec 이 mirror 할 구조(guard override + 임시 baseDir fs 격리 + measureAndConfirmBaseline loop 호출 + established/compared 양분기 + stepClock 결정론화 관용구 + errorRate 위반 관찰-전용 established write). contribution 은 assessment 의 `period` optional 분기가 없으므로 그 부분만 덜어낸 형태.
- `test/perf/contribution-read.perf-spec.ts` — 대상 endpoint 계약: `GET /api/contributions?assessmentId=<id>` via `ContributionController.findByAssessment`, `assessmentId` 누락/빈 string → controller `BadRequestException`(400) 분기. mock `ContributionService`(findByAssessment/findById/create/remove) + passGuard override 패턴.
- `test/perf/latency-collector.ts` — `measureAndConfirmBaseline` / `measureBaselineCandidate` / `RequestFn` 시그니처(호출만, 수정 금지).
- `test/perf/latency-baseline.ts` — `BaselineEnvMeta` / `parseBaselineReport` / `resolveBaselinePath`(호출만).
- `src/user/contribution.controller.ts` — 실 route·필수 query·400 분기 확인(정확한 query-param 이름·경로).
- `test/perf/README.md` — perf-spec 목록 절(새 spec cross-ref 1줄 추가 지점).
- `test/perf/jest-perf.json` — `testRegex` 확인(새 파일이 `pnpm test:perf` 에 자동 매칭되는지, 수정 불요).

## Acceptance Criteria

- [ ] `test/perf/contribution-measure-confirm.perf-spec.ts` 신설 — `ContributionController` `GET /api/contributions?assessmentId=<id>` 를 `measureAndConfirmBaseline` top loop 에 배선. mock `ContributionService`(useValue) + `JwtAuthGuard`/`RolesGuard` overrideGuard(passGuard) + `fs.mkdtemp` beforeEach 임시 baseDir 생성 / `fs.rmSync(recursive)` afterEach 정리(실 repo 미오염).
- [ ] **Happy-path test**: established(빈 baseDir 첫 호출 → outcome=established + baseline JSON 실 write, round-trip 동치·실 200 반영·errorRate 0·count>0·pass=true) 1+, compared(같은 baseDir 재호출 → outcome=compared + comparison·report, 1·2차 stepClock 주입으로 regressed=false 결정론) 1+.
- [ ] **Error path test**: 하위 예외가 부작용 없이 그대로 전파 — request 가 함수 아님(TypeError)·iterations 음수/NaN(RangeError)·env.label 빈 문자열(RangeError)·baseDir non-string(TypeError)/공백-only(RangeError)·저장 파일 손상 JSON(SyntaxError) 각 1+, 예외 시 파일 미생성(부작용 0) 검증 포함.
- [ ] **Flow / branch coverage**: 부재→established(write 발생) vs 존재→compared(read-only, mtime 불변) 분기 1+, opts.measure.iterations 위임(요청 횟수 == iterations) 1+, opts.compare tolerance 좁힘→regressed=true(회귀-검출) vs 기본 tolerance 소폭 증가→regressed=false(무회귀) 각 1+.
- [ ] **Negative cases 충분 cover** — 각 1+: opts 미지정(기본 iterations 30 established 도달)·요청 wrapper 인위 503 반환(errorRate 위반 pass=false candidate 가 throw 없이 established write, 관찰 전용)·**assessmentId 부재 실 400**(ContributionController 고유 query-param 예외경로 — service.findByAssessment 미호출·errorRate 1·count 0·established write 수행)·compared 회귀는 comparison.regressed=true 로만 노출·함수 throw 안 함(resolve)·measure reject 시 confirm 미도달로 파일 미생성·수동 조립(measureBaselineCandidate)과 established candidate 의 round-trip 동치(주입 clock 결정론).
- [ ] `test:perf` 통과 — `pnpm test:perf` 로 신규 spec 포함 전체 perf 스위트 green(신규 spec suite 추가, count>0). 실 wall-clock latency 비결정성은 stepClock 주입·baseline 존재 판정으로 회피(T-0881 결정론화 관용구).
- [ ] 전체 게이트 통과 — `pnpm lint && pnpm build && pnpm test:cov` green. src/ 변경 0 이므로 test:cov(line ≥ 80% / function ≥ 80%) 무회귀(perf-spec 자체는 `collectCoverageFrom=src/**` 라 미계측, pre-existing).
- [ ] `test/perf/README.md` 에 새 perf-spec 1줄 cross-ref 추가(요약·평가·기여 3 measure-confirm 배선 목록 정합).

## Out of Scope

- `latency-collector.ts` / `latency-baseline.ts` / `latency-baseline-io.ts` / `latency-metrics.ts` 등 collector·io·baseline 모듈 `.ts` 재수정 — 호출·import 만.
- 또 다른 endpoint(person/group/part/export/user 등 **조직 구조 read**) 동시 배선 — 본 spec 은 contribution 조회 1개만. 조직-구조 read 의 measure-confirm 배선은 **make-work 이므로 금지**(Follow-ups escalation 참조).
- `@Get(":id")` findOne(contribution-detail) 배선 / write route perf(POST/DELETE) / 실 Postgres·Prisma·LLM round-trip / 병렬·동시성 request(S3) / 실 baseline JSON repo 체크인(§5 #5 threshold fix) / CI perf job 재구성(§5 #4 — T-0878/T-0879 완료).
- §3 임계 표의 "baseline 후 fix" 실 수치 확정(§5 #5) — 실 측정 환경 필요, injected-clock spec 로는 정직하게 산출 불가.

## Suggested Sub-agents

`implementer → tester` (신규 production symbol 0 — perf-spec 자산 자체가 R-112 만족 test 이며, mock service·guard override·loop 배선 구성이 주 작업. architect 불요).

## Follow-ups

- **다음 planner 를 위한 escalation 지침(중요)**: T-0883 merge 후 **평가-결과 read 표면의 distinct measure-confirm 배선 vein 은 실질 소진**된다(health floor + summary + assessment + contribution 4 경로 cover). 이후 person/group/part 등 조직-구조 read 를 loop 에 배선하는 것은 REQ-048 "평가 결과 조회"가 아니라 make-work 다. 남은 genuine 방향은 모두 **gated** 이므로 planner 는 make-work 대신 escalation 을 우선한다:
  - §5 #3 (S1/S3 부하 harness) — k6/artillery/autocannon 신규 dependency 필요, ADR-0054 PROPOSED, **owner 승인 gated**(CLAUDE.md §5 BLOCKED). → owner 승인 humanQuestion.
  - §5 #5 (baseline 확정 + 임계 fix) — 실 측정 환경(고정 CPU/DB/네트워크) 필요, injected-clock spec 로 산출 불가. → 실 측정 환경 확보 escalation.
  - P6 frontend(React+Vite, 옵션 5·4·2 뒤) / P7 잔여는 이미 대부분 shipped.
  - 위 방향이 전부 gated 라면 planner 는 신규 make-work task 를 만들지 말고 `STATE.humanQuestions` 에 "S2 measure-confirm vein 소진 — 다음 우선순위 결정 필요(k6 도입 승인 / 실측 환경 / P6 착수 중 택)" escalation 을 박제하고 종료한다.
